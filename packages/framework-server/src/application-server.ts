import * as cluster from "cluster";
import {applyDefaults, ClassType, each, getClassName} from "@super-hornet/core";
import {WebSocketWorker} from './worker';
import {Server} from "http";
import {DynamicModule, ProviderWithScope, ServiceContainer} from '@super-hornet/framework-server-common';
import {SuperHornetBaseModule} from "./super-hornet-base.module";

export class ApplicationServerConfig {
    host: string = '127.0.0.1';

    port: number = 8080;

    path: string = '/';

    workers: number = 1;

    server?: Server;

    maxPayload?: number;
}

export class ApplicationServer {
    protected config: ApplicationServerConfig;
    protected masterWorker?: WebSocketWorker;
    protected serviceContainer = new ServiceContainer;

    constructor(
        appModule: ClassType<any>,
        config: Partial<ApplicationServerConfig> = {},
        providers: ProviderWithScope[] = [],
        imports: (ClassType<any> | DynamicModule)[] = []
    ) {
        this.config = applyDefaults(ApplicationServerConfig, config);

        imports.unshift(SuperHornetBaseModule.forRoot());
        this.serviceContainer.processRootModule(appModule, providers, imports);
    }

    getInjector() {
        return this.serviceContainer.getRootContext().getInjector();
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
            if (module.onDestroy) {
                await module.onDestroy();
            }
        }
    }

    protected done() {
        for (const [name, controller] of this.serviceContainer.controllerByName.entries()) {
            console.log('registered controller', name, getClassName(controller));
        }

        console.log(`Server up and running`);
    }

    protected async bootstrapMain() {
        for (const module of this.serviceContainer.getRegisteredModules()) {
            if (module.onBootstrapMain) {
                await module.onBootstrapMain();
            }
        }
    }

    protected async bootstrap() {
        for (const module of this.serviceContainer.getRegisteredModules()) {
            if (module.onBootstrap) {
                await module.onBootstrap();
            }
        }
    }

    public async start() {
        await this.bootstrap();

        if (this.config.workers > 1) {
            if (cluster.isMaster) {
                await this.bootstrapMain();

                for (let i = 0; i < this.config.workers; i++) {
                    cluster.fork();
                }

                this.done();
            } else {
                const worker = new WebSocketWorker(this.serviceContainer, {
                    server: this.config.server,
                    host: this.config.host,
                    port: this.config.port,
                    path: this.config.path,
                    maxPayload: this.config.maxPayload,
                });

                cluster.on('exit', (w) => {
                    console.log('mayday! mayday! worker', w.id, ' is no more!');
                    cluster.fork();
                });

                worker.run();
            }
        } else {
            await this.bootstrapMain();

            this.masterWorker = new WebSocketWorker(this.serviceContainer, {
                server: this.config.server,
                host: this.config.host,
                port: this.config.port,
                path: this.config.path,
                maxPayload: this.config.maxPayload,
            });
            await this.masterWorker!.run();
            this.done();
        }
    }
}
