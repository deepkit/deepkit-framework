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

import {WebWorker} from './worker';
import {ServiceContainer} from './service-container';
import {each, getClassName} from '@deepkit/core';
import {httpClass} from './decorator';
import * as cluster from 'cluster';
import {ApplicationConfig} from './application-config';
import {injectable} from './injector/injector';

@injectable()
export class ApplicationServer {
    protected masterWorker?: WebWorker;

    constructor(
        protected config: ApplicationConfig,
        protected serviceContainer: ServiceContainer,
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
            if (this.masterWorker) {
                this.masterWorker.close();
            }
        }
    }

    protected done() {
        for (const [name, controller] of this.serviceContainer.rpcControllers.entries()) {
            console.log('RPC controller', name, getClassName(controller));
        }

        for (const controller of this.serviceContainer.routerControllers.controllers) {
            const httpConfig = httpClass._fetch(controller)!;
            console.log('HTTP controller', httpConfig.baseUrl || '/', getClassName(controller));

            for (const action of httpConfig.actions) {
                console.log(`    ${action.httpMethod} ${httpConfig.getUrl(action)} ${action.methodName}`);
            }
        }

        console.log(`Server up and running at http://${this.config.host}:${this.config.port}/`);
    }

    protected async bootstrap() {
        for (const module of this.serviceContainer.getRegisteredModules()) {
            if (module.onBootstrapServer) {
                await module.onBootstrapServer();
            }
        }
    }

    public async start() {
        if (this.config.workers > 1) {
            if (cluster.isMaster) {
                await this.bootstrap();

                for (let i = 0; i < this.config.workers; i++) {
                    cluster.fork();
                }

                this.done();
            } else {
                new WebWorker(cluster.worker.id, this.serviceContainer, this.config);

                cluster.on('exit', (w) => {
                    console.log('mayday! mayday! worker', w.id, ' is no more!');
                    cluster.fork();
                });
            }
        } else {
            await this.bootstrap();

            this.masterWorker = new WebWorker(1, this.serviceContainer, this.config);
            this.done();
        }
    }
}
