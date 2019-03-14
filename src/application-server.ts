import * as cluster from "cluster";
import {ClassType, getClassName} from "@marcj/estdlib";
import {Worker} from './worker';
import {Provider, ReflectiveInjector} from "injection-js";
import {FS} from "./fs";
import {Exchange} from "./exchange";
import {ExchangeDatabase, ExchangeNotifyPolicy} from "./exchange-database";
import {getApplicationModuleOptions, getControllerOptions} from "./decorators";
import {Database, getTypeOrmEntity} from "@marcj/marshal-mongo";
import {Application} from "./application";
import {applyDefaults, each, eachPair} from "@marcj/estdlib";
import {Server} from "http";
import {ServerOptions} from "ws";
import {createConnection, Connection} from "typeorm";

export class ApplicationServerConfig {
    server?: Server = undefined;

    host: string = '127.0.0.1';

    port: number = 8080;

    workers: number = 1;

    mongoHost: string = 'localhost';

    mongoPort: number = 27017;

    mongoDbName: string = 'glut';

    mongoConnectionName: string = 'default';

    /**
     * Whether entity definition (mongo indices) should be synchronised on bootstrap.
     */
    mongoSynchronize: boolean = false;

    redisHost: string = 'localhost';

    redisPort: number = 6379;

    redisPrefix: string = 'glut';

    fsPath: string = '~/.glut/files';
}


export class ApplicationServer {
    protected config: ApplicationServerConfig;
    protected injector?: ReflectiveInjector;

    protected connection?: Connection;

    protected masterWorker?: Worker;

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
    }

    public static createForModule<T extends Application>(application: ClassType<T>) {
        const options = getApplicationModuleOptions(application);
        return new this(
            application,
            options.config || {},
            options.serverProviders || [],
            options.connectionProviders || [],
            options.controllers,
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
                    this.connection.close();
                }

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

        console.log(`Server up and running (connection: ${this.config.mongoConnectionName})`);
    }

    protected async bootstrap() {
        this.connection = await createConnection({
            type: "mongodb",
            host: this.config.mongoHost,
            port: this.config.mongoPort,
            database: this.config.mongoDbName,
            name: this.config.mongoConnectionName,
            useNewUrlParser: true,
            synchronize: this.config.mongoSynchronize,
            entities: this.entities.map(v => getTypeOrmEntity(v))
        });

        const baseInjectors: Provider[] = [
            {provide: Application, useClass: this.application},
            {provide: ApplicationServerConfig, useValue: this.config},
            {provide: 'fs.path', useValue: this.config.fsPath},
            {provide: 'redis.host', useValue: this.config.redisHost},
            {provide: 'redis.port', useValue: this.config.redisPort},
            {provide: 'redis.prefix', useValue: this.config.redisPrefix},
            {provide: 'mongo.dbName', useValue: this.config.mongoDbName},
            {provide: 'mongo.host', useValue: this.config.mongoHost + ':' + this.config.mongoPort},
            {provide: Connection, useValue: this.connection},
            {
                provide: FS,
                deps: [Exchange, ExchangeDatabase, 'fs.path'],
                useFactory: (exchange: Exchange, database: ExchangeDatabase, fsPath: string) => new FS(exchange, database, fsPath)
            },
            {
                provide: Exchange,
                deps: ['redis.host', 'redis.port', 'redis.prefix'],
                useFactory: (host: string, port: number, prefix: string) => new Exchange(host, port, prefix)
            },
            {
                provide: Database, deps: [Connection, 'mongo.dbName'], useFactory: (connection, dbName) => {
                    return new Database(connection, dbName);
                }
            },
            {
                provide: ExchangeDatabase, deps: [Application, Database, Exchange],
                useFactory: (a: Application, d: Database, e: Exchange) => {
                    return new ExchangeDatabase(new class implements ExchangeNotifyPolicy {
                        notifyChanges<T>(classType: ClassType<T>): boolean {
                            return a.notifyChanges(classType);
                        }
                    }, d, e);
                }
            },
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
                const app: Application = this.getInjector().get(Application);
                await app.bootstrap();

                for (let i = 0; i < this.config.workers; i++) {
                    cluster.fork();
                }

                this.done();
            } else {
                const worker = new Worker(this.getInjector(), this.connectionProvider, {
                    host: this.config.host,
                    port: this.config.port,
                });

                cluster.on('exit', (w) => {
                    console.log('mayday! mayday! worker', w.id, ' is no more!');
                    cluster.fork();
                });

                worker.run();
            }
        } else {
            const app: Application = this.getInjector().get(Application);
            await app.bootstrap();

            let options: ServerOptions = {
                host: this.config.host,
                port: this.config.port,
            };
            if (this.config.server) {
                options = {
                    server: this.config.server
                };
            }

            this.masterWorker = new Worker(this.getInjector(), this.connectionProvider, options);
            this.masterWorker.run();
            this.done();
        }
    }
}
