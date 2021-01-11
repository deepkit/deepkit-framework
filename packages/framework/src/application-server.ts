/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { each, getClassName } from '@deepkit/core';
import { createRpcConnection, WebWorker, WebWorkerFactory } from './worker';
import { RpcControllers } from './service-container';
import { EventDispatcher, BaseEvent, eventDispatcher, EventToken } from './event';
import cluster from 'cluster';
import { inject, injectable, InjectorContext } from './injector/injector';
import { Logger } from './logger';
import { kernelConfig } from './kernel.config';
import { HttpControllers } from './router';
import { httpClass } from './decorator';
import { DirectClient, RpcClient, RpcKernel } from '@deepkit/rpc';

export class ServerBootstrapEvent extends BaseEvent { }

/**
 * Called only once for application server bootstrap (in the cluster main process)
 * as soon as the application server starts.
 */
export const onServerMainBootstrap = new EventToken('server.main.bootstrap', ServerBootstrapEvent);

/**
 * Called only once for application server bootstrap (in the cluster main process)
 * as soon as the application server has started.
 */
export const onServerMainBootstrapDone = new EventToken('server.main.bootstrapDone', ServerBootstrapEvent);

/**
 * Called for each worker as soon as the worker bootstraps.
 */
export const onServerWorkerBootstrap = new EventToken('server.worker.bootstrap', ServerBootstrapEvent);

export class ServerShutdownEvent extends BaseEvent { }

/**
 * Called when application server shuts down in the main process.
 */
export const onServerMainShutdown = new EventToken('server.main.shutdown', ServerBootstrapEvent);

class ApplicationServerConfig extends kernelConfig.slice(['server', 'port', 'host', 'workers']) { }

@injectable()
export class ApplicationServerListener {
    constructor(
        protected logger: Logger,
        protected rpcControllers: RpcControllers,
        protected httpControllers: HttpControllers,
        protected config: ApplicationServerConfig,
    ) {
    }

    @eventDispatcher.listen(onServerMainBootstrapDone)
    onBootstrapDone() {
        for (const [name, controller] of this.rpcControllers.controllers.entries()) {
            this.logger.log('RPC', `<yellow>${getClassName(controller)}</yellow>`, `<grey>${name}</grey>`);
        }

        for (const controller of this.httpControllers.controllers.values()) {
            const httpConfig = httpClass._fetch(controller)!;
            this.logger.log('HTTP', `<yellow>${getClassName(controller)}</yellow>`);

            for (const action of httpConfig.getActions()) {
                this.logger.log(`    ${action.httpMethod} ${httpConfig.getUrl(action)} <grey>${action.methodName}</grey>`);
            }
        }

        if (this.config.server) {
            this.logger.log(`Server up and running`);
        } else {
            this.logger.log(`Server up and running at http://${this.config.host}:${this.config.port}/`);
        }
    }
}

@injectable()
export class ApplicationServer {
    protected worker?: WebWorker;
    protected started = false;

    constructor(
        protected logger: Logger,
        protected webWorkerFactory: WebWorkerFactory,
        protected eventDispatcher: EventDispatcher,
        protected rootScopedContext: InjectorContext,
        protected config: ApplicationServerConfig,
    ) {
    }

    public async close() {
        if (this.config.workers > 1) {
            for (const worker of each(cluster.workers)) {
                if (worker) {
                    worker.kill();
                }
            }
        } else {
            await this.shutdown();
            if (this.worker) {
                this.worker.close();
            }
        }
    }

    public async shutdown() {
        await this.eventDispatcher.dispatch(onServerMainShutdown, new ServerShutdownEvent());
    }

    protected async bootstrap() {
        await this.eventDispatcher.dispatch(onServerMainBootstrap, new ServerBootstrapEvent());
    }

    protected async bootstrapDone() {
        await this.eventDispatcher.dispatch(onServerMainBootstrapDone, new ServerBootstrapEvent());
    }

    public async start() {
        if (this.started) throw new Error('ApplicationServer already started');
        this.started = true;

        //listening to this signal is required to make ts-node-dev working with its reload feature.
        process.on('SIGTERM', () => {
            console.log('Received SIGTERM.');
            process.exit(0);
        });

        if (cluster.isMaster) {
            this.logger.log(`Start HTTP server, using ${this.config.workers} workers.`);
        }

        if (this.config.workers > 1) {
            if (cluster.isMaster) {
                await this.bootstrap();

                for (let i = 0; i < this.config.workers; i++) {
                    cluster.fork();
                }

                await this.bootstrapDone();
            } else {
                await this.eventDispatcher.dispatch(onServerWorkerBootstrap, new ServerBootstrapEvent());
                this.worker = this.webWorkerFactory.create(cluster.worker.id, this.config);

                cluster.on('exit', (w) => {
                    this.logger.warning(`Worker ${w.id} died.`);
                    cluster.fork();
                });
            }
        } else {
            await this.bootstrap();
            await this.eventDispatcher.dispatch(onServerWorkerBootstrap, new ServerBootstrapEvent());
            this.worker = this.webWorkerFactory.create(1, this.config);
            await this.bootstrapDone();
        }
    }

    public getWorker(): WebWorker {
        if (!this.worker) throw new Error('No WebWorker registered yet. Did you start()?');
        return this.worker;
    }

    public createClient() {
        const worker = this.getWorker();
        const context = this.rootScopedContext;
        const kernel = worker.rpcKernel;

        return new RpcClient({
            connect(connection) {
                const kernelConnection = createRpcConnection(context, kernel, { write: (buffer) => connection.onMessage(buffer) });

                connection.onConnected({
                    disconnect() {
                        kernelConnection.close();
                    },
                    send(message) {
                        queueMicrotask(() => {
                            kernelConnection.feed(message);
                        });
                    }
                });
            }
        });
    }
}

export class InMemoryApplicationServer extends ApplicationServer {

}