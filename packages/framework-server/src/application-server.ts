import * as cluster from "cluster";
import {applyDefaults, ClassType, each, getClassName, isClass} from "@super-hornet/core";
import {Worker} from './worker';
import {Provider, ReflectiveInjector} from "injection-js";
import {getControllerOptions,} from "./decorators";
import {Server} from "http";
import {HornetBaseModule} from "./hornet-base.module";
import {
    getModuleOptions,
    isModuleWithProviders,
    isProviderSingleScope,
    ModuleWithProviders,
    ProviderWithScope,
    SuperHornetModule
} from '@super-hornet/framework-server-common';

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
    protected injector?: ReflectiveInjector;
    protected masterWorker?: Worker;

    protected moduleTypes = new Set<ClassType<any>>();
    protected controllers = new Set<ClassType<any>>();

    protected rootProviders: Provider[] = [];
    protected sessionProviders: Provider[] = [];
    protected requestProviders: Provider[] = [];

    constructor(
        protected appModule: ClassType<any>,
        config: Partial<ApplicationServerConfig> = {},
        providers: ProviderWithScope[] = [],
        imports: (ClassType<any> | ModuleWithProviders)[] = []
    ) {
        this.config = applyDefaults(ApplicationServerConfig, config);

        this.processModule(HornetBaseModule);
        this.processModule(appModule);
        this.registerProviders(providers);
        for (const module of imports) this.processModule(module);

        const rootProviders = this.rootProviders.slice(0);
        rootProviders.push({provide: ApplicationServerConfig, useValue: this.config});
        rootProviders.push({provide: 'controllers', useValue: this.controllers});

        this.injector = ReflectiveInjector.resolveAndCreate(rootProviders);
        for (const moduleType of this.moduleTypes) {
            this.getInjector().get(moduleType); //just create all modules, to allow to configure them self further.
        }
    }

    protected processModule(appModule: ClassType<any> | ModuleWithProviders) {
        let module = isModuleWithProviders(appModule) ? appModule.module : appModule;
        let options = getModuleOptions(module);
        if (!options) return;

        const providers = options.providers ? options.providers.slice(0) : [];

        if (isModuleWithProviders(appModule)) {
            providers.push(...appModule.providers);
        }

        if (this.moduleTypes.has(module)) return;
        this.moduleTypes.add(module);

        if (options.imports) {
            for (const imp of options.imports) this.processModule(imp);
        }

        if (options.controllers) {
            for (const controller of options.controllers) this.controllers.add(controller);
        }

        if (providers) this.registerProviders(providers);
    }

    protected registerProviders(providers: ProviderWithScope[]) {
        function normalize(provider: ProviderWithScope): Provider {
            if (isClass(provider)) {
                return provider;
            }

            if (isProviderSingleScope(provider)) {
                return {provide: provider.provide, useExisting: provider.provide};
            }

            return provider;
        }

        for (const provider of providers) {
            if (provider.scope === 'session') {
                this.sessionProviders.push(normalize(provider));
            } else if (provider.scope === 'request') {
                this.requestProviders.push(normalize(provider));
            } else {
                this.rootProviders.push(normalize(provider));
            }
        }
    }

    public getInjector(): ReflectiveInjector {
        if (!this.injector) {
            throw new Error('ApplicationServer not bootstrapped.');
        }

        return this.injector;
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

        for (const moduleType of this.moduleTypes) {
            const module = this.getInjector().get(moduleType) as SuperHornetModule;
            if (module.onDestroy) {
                await module.onDestroy();
            }
        }
    }

    protected done() {
        for (const controller of this.controllers) {
            const options = getControllerOptions(controller);
            if (!options) continue;
            console.log('registered controller', options.name, getClassName(controller));
        }

        console.log(`Server up and running`);
    }

    protected async bootstrapMain() {
        for (const moduleType of this.moduleTypes) {
            const module = this.getInjector().get(moduleType) as SuperHornetModule;
            if (module.bootstrapMain) {
                await module.bootstrapMain();
            }
        }
    }

    protected async bootstrap() {
        for (const moduleType of this.moduleTypes) {
            const module = this.getInjector().get(moduleType) as SuperHornetModule;
            if (module.bootstrap) {
                await module.bootstrap();
            }
        }

        // const mongoHost = isAbsolute(this.config.mongoHost) ? encodeURIComponent(this.config.mongoHost) : (this.config.mongoHost + ':' + this.config.mongoPort);
        // this.connection = new Connection(mongoHost, this.config.mongoDbName);
        //
        // const self = this;
        // const baseInjectors: Provider[] = [
        //     {provide: Application, useClass: this.appModule},
        //     {provide: ApplicationServerConfig, useValue: this.config},
        //     {provide: 'fs.path', useValue: this.config.fsPath},
        //     {provide: 'exchange.unixPath', useValue: this.config.exchangeUnixPath},
        //     {provide: 'mongo.dbName', useValue: this.config.mongoDbName},
        //     {provide: 'mongo.host', useValue: mongoHost},
        //     {
        //         provide: FileType, deps: [], useFactory: () => {
        //             return FileType.forDefault();
        //         }
        //     },
        //     {provide: Connection, useValue: this.connection},
        //     {
        //         provide: Exchange,
        //         deps: ['exchange.unixPath'],
        //         useFactory: (unixPath: string | number) => new Exchange(unixPath)
        //     },
        //     {
        //         provide: ExchangeServer,
        //         deps: ['exchange.unixPath'],
        //         useFactory: (unixPath: string | number) => new ExchangeServer(unixPath)
        //     },
        //     {
        //         provide: Database, deps: [Connection], useFactory: (connection: Connection) => {
        //             return new Database(connection);
        //         }
        //     },
        //     {
        //         provide: ExchangeDatabase, deps: [Database, Exchange],
        //         useFactory: (d: Database, e: Exchange) => {
        //             return new ExchangeDatabase(new class implements ExchangeNotifyPolicy {
        //                 notifyChanges<T>(classType: ClassType<T>): boolean {
        //                     return self.injector!.get(Application).notifyChanges(classType);
        //                 }
        //             }, d, e);
        //         }
        //     },
        //     ProcessLocker,
        //     GlobalLocker,
        //     FS,
        //     InternalClient,
        // ];
        //
        // baseInjectors.push(...this.serverProvider);
        //
        // this.injector = ReflectiveInjector.resolveAndCreate(baseInjectors);
        // const app: Application = this.injector.get(Application);
        //
        // app.entityChangeFeeds.push(...this.entityChangeFeeds);
        //
        // this.connectionProvider.push(...this.controllers);
        //
        // for (const controllerClass of this.controllers) {
        //     const options = getControllerOptions(controllerClass);
        //     if (!options) {
        //         throw new Error(`Controller ${getClassName(controllerClass)} has no @Controller decorator.`);
        //     }
        //     app.controllers[options.name] = controllerClass;
        // }
    }

    public async start() {
        await this.bootstrap();

        process.on('unhandledRejection', error => {
            console.log(error);
            process.exit(1);
        });

        if (this.config.workers > 1) {
            if (cluster.isMaster) {
                await this.bootstrapMain();

                for (let i = 0; i < this.config.workers; i++) {
                    cluster.fork();
                }

                this.done();
            } else {
                const worker = new Worker(this.getInjector(), this.sessionProviders, {
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

            this.masterWorker = new Worker(this.getInjector(), this.sessionProviders, {
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
