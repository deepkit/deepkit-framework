/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { each, getClassName } from '@deepkit/core';
import { RpcClient } from '@deepkit/rpc';
import cluster from 'cluster';
import { httpClass, HttpControllers } from '@deepkit/http';
import { BaseEvent, EventDispatcher, eventDispatcher, EventToken } from '@deepkit/event';
import { injectable, InjectorContext } from '@deepkit/injector';
import { kernelConfig } from './kernel.config';
import { Logger } from '@deepkit/logger';
import { RpcControllers } from './application-service-container';
import { createRpcConnection, WebWorker, WebWorkerFactory } from './worker';

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

class ApplicationServerConfig extends kernelConfig.slice(['server', 'port', 'host', 'httpsPort',
    'ssl', 'sslKey', 'sslCertificate', 'sslCa', 'sslCrl',
    'varPath', 'selfSigned', 'keepAliveTimeout', 'workers']) { }

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
            if (this.config.ssl) {
                this.logger.log(`HTTPS listening at https://${this.config.host}:${this.config.httpsPort || this.config.port}/`);
            }

            if (!this.config.ssl || (this.config.ssl && this.config.httpsPort)) {
                this.logger.log(`HTTP listening at http://${this.config.host}:${this.config.port}/`);
            }
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
        public config: ApplicationServerConfig,
    ) {
    }

    public async close() {
        if (this.config.workers > 1) {
            for (const worker of each(cluster.workers)) {
                if (worker) {
                    worker.kill();
                }
            }
            await this.shutdown();
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
                this.worker.start();

                cluster.on('exit', (w) => {
                    this.logger.warning(`Worker ${w.id} died.`);
                    cluster.fork();
                });
            }
        } else {
            await this.bootstrap();
            await this.eventDispatcher.dispatch(onServerWorkerBootstrap, new ServerBootstrapEvent());
            this.worker = this.webWorkerFactory.create(1, this.config);
            this.worker.start();
            await this.bootstrapDone();
        }
    }

    public getWorker(): WebWorker {
        if (!this.worker) throw new Error('No WebWorker registered yet. Did you start()?');
        return this.worker;
    }

    public createClient(): RpcClient {
        const worker = this.getWorker();
        const context = this.rootScopedContext;
        const kernel = worker.rpcKernel;

        return new RpcClient({
            connect(connection) {
                const kernelConnection = createRpcConnection(context, kernel, {
                    write: (buffer) => connection.onData(buffer),
                    close: () => connection.onClose(),
                });

                connection.onConnected({
                    close() {
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
