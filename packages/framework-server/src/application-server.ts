import * as cluster from "cluster";
import {ClassType, getClassName} from "@super-hornet/core";
import {Worker} from './worker';
import {Provider, ReflectiveInjector} from "injection-js";
import {FS} from "./fs";
import {Exchange} from "./exchange";
import {ExchangeDatabase, ExchangeNotifyPolicy} from "./exchange-database";
import {getApplicationModuleOptions, getControllerOptions} from "./decorators";
import {Database, Connection} from "@super-hornet/marshal-mongo";
import {Application} from "./application";
import {applyDefaults, each, eachPair} from "@super-hornet/core";
import {FileType} from "@super-hornet/framework-core";
import {ProcessLocker} from "./process-locker";
import {InternalClient} from "./internal-client";
import {homedir} from "os";
import {GlobalLocker} from "./global-locker";
import {ExchangeServer} from "./exchange-server";
import {Server} from "http";
import {isAbsolute} from "path";

export class ApplicationServerConfig {
    host: string = '127.0.0.1';

    port: number = 8080;

    workers: number = 1;

    mongoHost: string = 'localhost';

    mongoPort?: number = 27017;

    mongoDbName: string = 'super-hornet';

    server?: Server;

    maxPayload?: number;

    fsPath: string = '~/.super-hornet/files';

    /** or port number **/
    exchangeUnixPath: string | number = '/tmp/super-hornet-exchange.sock';
}


export class ApplicationServer {
    protected config: ApplicationServerConfig;
    protected injector?: ReflectiveInjector;

    protected connection?: Connection;

    protected masterWorker?: Worker;

    /**
     * The port used in workers.
     */
    public port: number = 0;

    constructor(
        protected application: ClassType<any>,
        config: ApplicationServerConfig | Partial<ApplicationServerConfig> = {},
        protected serverProvider: Provider[] = [],
        protected connectionProvider: Provider[] = [],
        protected controllers: ClassType<any>[] = [],
        protected entities: ClassType<any>[] = [],
        protected entityChangeFeeds: ClassType<any>[] = [],
    ) {
        this.config = config instanceof ApplicationServerConfig ? config : applyDefaults(ApplicationServerConfig, config);
        this.config.fsPath = this.config.fsPath.replace('~', homedir());
    }

    public static createForModule<T extends Application>(application: ClassType<T>) {
        const options = getApplicationModuleOptions(application);
        return new this(
            application,
            options.config || {},
            options.serverProviders || [],
            options.connectionProviders || [],
            options.controllers,
            options.entitiesForTypeOrm,
            options.notifyEntities,
        );
    }

    public getApplication(): Application {
        return this.getInjector().get(Application);
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

                if (this.connection) {
                    this.connection.close(true);
                }

                (this.getInjector().get(ExchangeServer) as ExchangeServer).close();

                const exchange: Exchange = this.getInjector().get(Exchange);
                await exchange.disconnect();

                this.masterWorker.close();
            }
        }
    }

    protected done() {
        for (const [name, controllerClass] of eachPair(this.getApplication().controllers)) {
            console.log('registered controller', name, getClassName(controllerClass));
        }

        console.log(`Server up and running`);
    }

    protected async bootstrap() {
        const mongoHost = isAbsolute(this.config.mongoHost) ? encodeURIComponent(this.config.mongoHost) : (this.config.mongoHost + ':' + this.config.mongoPort);
        this.connection = new Connection(mongoHost, this.config.mongoDbName);

        const self = this;
        const baseInjectors: Provider[] = [
            {provide: Application, useClass: this.application},
            {provide: ApplicationServerConfig, useValue: this.config},
            {provide: 'fs.path', useValue: this.config.fsPath},
            {provide: 'exchange.unixPath', useValue: this.config.exchangeUnixPath},
            {provide: 'mongo.dbName', useValue: this.config.mongoDbName},
            {provide: 'mongo.host', useValue: mongoHost},
            {
                provide: FileType, deps: [], useFactory: () => {
                    return FileType.forDefault();
                }
            },
            {provide: Connection, useValue: this.connection},
            {
                provide: Exchange,
                deps: ['exchange.unixPath'],
                useFactory: (unixPath: string | number) => new Exchange(unixPath)
            },
            {
                provide: ExchangeServer,
                deps: ['exchange.unixPath'],
                useFactory: (unixPath: string | number) => new ExchangeServer(unixPath)
            },
            {
                provide: Database, deps: [Connection], useFactory: (connection: Connection) => {
                    return new Database(connection);
                }
            },
            {
                provide: ExchangeDatabase, deps: [Database, Exchange],
                useFactory: (d: Database, e: Exchange) => {
                    return new ExchangeDatabase(new class implements ExchangeNotifyPolicy {
                        notifyChanges<T>(classType: ClassType<T>): boolean {
                            return self.injector!.get(Application).notifyChanges(classType);
                        }
                    }, d, e);
                }
            },
            ProcessLocker,
            GlobalLocker,
            FS,
            InternalClient,
        ];

        baseInjectors.push(...this.serverProvider);

        this.injector = ReflectiveInjector.resolveAndCreate(baseInjectors);
        const app: Application = this.injector.get(Application);

        app.entityChangeFeeds.push(...this.entityChangeFeeds);

        this.connectionProvider.push(...this.controllers);

        for (const controllerClass of this.controllers) {
            const options = getControllerOptions(controllerClass);
            if (!options) {
                throw new Error(`Controller ${getClassName(controllerClass)} has no @Controller decorator.`);
            }
            app.controllers[options.name] = controllerClass;
        }
    }

    public async start() {
        await this.bootstrap();

        process.on('unhandledRejection', error => {
            console.log(error);
            process.exit(1);
        });

        if (this.config.workers > 1) {
            if (cluster.isMaster) {
                (this.getInjector().get(ExchangeServer) as ExchangeServer).start();

                const app: Application = this.getInjector().get(Application);
                await app.bootstrap();

                for (let i = 0; i < this.config.workers; i++) {
                    cluster.fork();
                }

                this.done();
            } else {
                const worker = new Worker(this.getInjector(), this.connectionProvider, {
                    server: this.config.server,
                    host: this.config.host,
                    port: this.config.port,
                    maxPayload: this.config.maxPayload,
                });

                cluster.on('exit', (w) => {
                    console.log('mayday! mayday! worker', w.id, ' is no more!');
                    cluster.fork();
                });

                worker.run();
            }
        } else {
            (this.getInjector().get(ExchangeServer) as ExchangeServer).start();
            const app: Application = this.getInjector().get(Application);
            await app.bootstrap();

            this.masterWorker = new Worker(this.getInjector(), this.connectionProvider, {
                server: this.config.server,
                host: this.config.host,
                port: this.config.port,
                maxPayload: this.config.maxPayload,
            });
            await this.masterWorker!.run();
            this.done();
        }
    }
}
