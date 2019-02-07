import * as cluster from "cluster";
import {AnyType, ArrayType, ClassType, getClassName, NumberType, plainToClass, StringType} from "@marcj/marshal";
import {Worker} from './worker';
import {Injectable, Injector, Provider, ReflectiveInjector} from "injection-js";
import {FS} from "./fs";
import {Exchange} from "./exchange";
import {ExchangeDatabase} from "./exchange-database";
import {getApplicationModuleOptions, getControllerOptions} from "./decorators";
import {Database} from "@marcj/marshal-mongo";
import {Mongo} from "./mongo";
import {Application} from "./application";
import {eachPair} from "@kamille/core";

export function applyDefaults<T>(classType: ClassType<T>, target: {[k: string]: any}): T {
    const classInstance = new classType();

    for (const [i, v] of eachPair(target)) {
        (classInstance as any)[i] = v;
    }

    return classInstance;
}

export class ApplicationServerConfig {
    host: string = 'localhost';

    port: number = 8080;

    workers: number = 4;

    mongoHost: string = 'localhost';

    mongoPort: number = 27017;

    mongoDbName: string = 'kamille';

    redisHost: string = 'localhost';

    redisPort: number = 6380;

    redisPrefix: string = 'kamille';

    fsPath: string = '~/.kamille/files';
}


export class ApplicationServer {
    protected config: ApplicationServerConfig;
    protected injector: ReflectiveInjector;

    constructor(
        application: ClassType<any>,
        config: ApplicationServerConfig | Partial<ApplicationServerConfig> = {},
        serverProvider: Provider[] = [],
        protected connectionProvider: Provider[] = [],
        controllers: ClassType<any>[] = [],
    ) {
        this.config = config instanceof ApplicationServerConfig ? config : applyDefaults(ApplicationServerConfig, config);

        const baseInjectors: Provider[] = [
            {provide: Application, useClass: application},
            {provide: ApplicationServerConfig, useValue: this.config},
            {provide: 'fs.path', useValue: this.config.fsPath},
            {provide: 'redis.host', useValue: this.config.redisHost},
            {provide: 'redis.port', useValue: this.config.redisPort},
            {provide: 'redis.prefix', useValue: this.config.redisPrefix},
            {provide: 'mongo.dbName', useValue: this.config.mongoDbName},
            {provide: 'mongo.host', useValue: this.config.mongoHost + ':' + this.config.mongoPort},
            ExchangeDatabase,
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
                provide: Database, deps: [Mongo], useFactory: (mongo: Mongo) => {
                    new Database(async () => {
                        return mongo.connect();
                    }, mongo.dbName);
                }
            },
            {
                provide: ExchangeDatabase, deps: [Application, Mongo, Database, Exchange],
                useFactory: (a: Application, m: Mongo, d: Database, e: Exchange) => {
                    return new ExchangeDatabase(a, m, d, e);
                }
            },
            // {provide: Injector, useFactory: () => this.injector}, doesn't work because Injector is not a class
            {
                provide: Mongo,
                deps: ['mongo.host', 'mongo.dbName'],
                useFactory: (host: string, dbName: string) => new Mongo(host, dbName)
            },
        ];

        baseInjectors.push(...controllers);
        baseInjectors.push(...serverProvider);

        this.injector = ReflectiveInjector.resolveAndCreate(baseInjectors);
        const app: Application = this.injector.get(Application);

        for (const controllerClass of controllers) {
            const options = getControllerOptions(controllerClass);
            console.log('options', options);
            if (!options) {
                throw new Error(`Controller ${getClassName(controllerClass)} has no @Controller decorator.`);
            }
            app.controllers[options.name] = controllerClass;
            console.log(`Controller ${options.name} (${getClassName(controllerClass)}) setup`);
        }
    }

    public static createForModule<T extends Application>(application: ClassType<T>) {
        const options = getApplicationModuleOptions(application);
        return new this(application, options.config || {}, options.serverProviders || [], options.connectionProviders || [], options.controllers);
    }

    public async start() {
        process.on('unhandledRejection', error => {
            console.log(error);
            process.exit(1);
        });

        if (cluster.isMaster) {
            const app: Application = this.injector.get(Application);
            await app.bootstrap();

            for (let i = 0; i < this.config.workers; i++) {
                cluster.fork();
            }

            console.log('master done');
        } else {
            const worker = new Worker(this.injector, this.connectionProvider, {
                host: this.config.host,
                port: this.config.port,
            });

            cluster.on('exit', (w) => {
                console.log('mayday! mayday! worker', w.id, ' is no more!');
                cluster.fork();
            });

            worker.run();
        }
    }
}
