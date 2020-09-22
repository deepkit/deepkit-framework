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

        for (const module of this.serviceContainer.getRegisteredModules()) {
            if (module.onShutDown) {
                await module.onShutDown();
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
