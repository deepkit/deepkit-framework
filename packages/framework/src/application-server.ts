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

import {each, getClassName} from '@deepkit/core';
import {WebWorker, WebWorkerFactory} from './worker';
import {EventDispatcher, RpcControllers} from './service-container';
import {BaseEvent, eventDispatcher, EventToken, httpClass} from './decorator';
import * as cluster from 'cluster';
import {injectable} from './injector/injector';
import { Logger } from './logger';
import {kernelConfig} from './kernel.config';
import { HttpControllers } from './router';

export class ServerBootstrapEvent extends BaseEvent {}
export const onServerBootstrap = new EventToken('server.bootstrap', ServerBootstrapEvent);
export const onServerBootstrapDone = new EventToken('server.bootstrap-done', ServerBootstrapEvent);

export class ServerShutdownEvent extends BaseEvent {}
export const onServerShutdown = new EventToken('server.shutdown', ServerBootstrapEvent);

class ApplicationServerConfig extends kernelConfig.slice(['server', 'port', 'host', 'workers']) {}

@injectable()
export class ApplicationServerListener {
    constructor(
        protected logger: Logger,
        protected rpcControllers: RpcControllers,
        protected httpControllers: HttpControllers,
        protected config: ApplicationServerConfig,
    ) {
    }

    @eventDispatcher.listen(onServerBootstrapDone)
    onBootstrapDone() {
        for (const [name, controller] of this.rpcControllers.controllers.entries()) {
            this.logger.log('RPC controller', name, getClassName(controller));
        }

        for (const controller of this.httpControllers.controllers.values()) {
            const httpConfig = httpClass._fetch(controller)!;
            this.logger.log('HTTP controller', httpConfig.baseUrl || '/', getClassName(controller));

            for (const action of httpConfig.actions) {
                this.logger.log(`    ${action.httpMethod} ${httpConfig.getUrl(action)} ${action.methodName}`);
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
    protected masterWorker?: WebWorker;

    constructor(
        protected logger: Logger,
        protected webWorkerFactory: WebWorkerFactory,
        protected eventDispatcher: EventDispatcher,
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
            if (this.masterWorker) {
                this.masterWorker.close();
            }
        }
    }

    public async shutdown() {
        await this.eventDispatcher.dispatch(onServerShutdown, new ServerShutdownEvent());
    }

    protected async bootstrap() {
        await this.eventDispatcher.dispatch(onServerBootstrap, new ServerBootstrapEvent());
    }

    protected async bootstrapDone() {
        await this.eventDispatcher.dispatch(onServerBootstrapDone, new ServerBootstrapEvent());
    }

    public async start() {
        if (this.config.workers > 1) {
            if (cluster.isMaster) {
                await this.bootstrap();
                for (let i = 0; i < this.config.workers; i++) {
                    cluster.fork();
                }

                await this.bootstrapDone();
            } else {
                this.webWorkerFactory.create(cluster.worker.id, this.config);

                cluster.on('exit', (w) => {
                    this.logger.warning('mayday! mayday! worker', w.id, ' is no more!');
                    cluster.fork();
                });
            }
        } else {
            await this.bootstrap();

            this.masterWorker = this.webWorkerFactory.create(1, this.config);
            await this.bootstrapDone();
        }
    }
}
