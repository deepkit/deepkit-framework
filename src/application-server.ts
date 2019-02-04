import * as cluster from "cluster";
import {ClassType, NumberType, plainToClass, StringType} from "@marcj/marshal";
import {Worker} from './worker';
import {Injector, Provider, ReflectiveInjector} from "injection-js";
import {FS} from "./fs";
import {Exchange} from "./exchange";
import {ExchangeDatabase} from "./exchange-database";
import {getApplicationModuleOptions} from "./decorators";

export class ApplicationServerConfig {
    @StringType()
    host: string = 'localhost';

    @NumberType()
    port: number = 8080;

    @NumberType()
    workers: number = 4;

    @StringType()
    mongoHost: string = 'localhost';

    @StringType()
    mongoPort: number = 27017;

    @StringType()
    redisHost: string = 'localhost';

    @NumberType()
    redisPort: number = 6380;

    @StringType()
    redisPrefix: string = 'kamille';

    @StringType()
    fsPath: string = '~/.kamille/files';
}

export class Session {
    constructor(
        public readonly username: string,
        public readonly token: any,
    ) {}
}

export class Application {
    public readonly controllers: {[path: string]: ClassType<any>} = {};

    public async bootstrap() {
    }

    /**
     *
     */
    public async hasAccess<T>(session: Session | undefined, controller: ClassType<T>, action: string): Promise<boolean> {
        return true;
    }

    public async getControllerForPath(path: string): Promise<ClassType<any> | undefined>  {
        return this.controllers[path];
    }

    /**
     * Authenticates the current connection.
     */
    public async authenticate(token: any): Promise<Session> {
        return new Session('anon', undefined);
    }
}

export class ApplicationServer {
    protected config: ApplicationServerConfig;
    protected injector: ReflectiveInjector;

    constructor(
        config: ApplicationServerConfig | Partial<ApplicationServerConfig> = {},
        serverProvider: Provider[] = [],
        protected connectionProvider: Provider[] = [],
        application: ClassType<any>,
    ) {
        this.config = config instanceof ApplicationServerConfig ? config : plainToClass(ApplicationServerConfig, config);

        const baseInjectors: Provider[] = [
            ExchangeDatabase,
            {provide: ApplicationServerConfig, useValue: this.config},
            {provide: 'fs.path', useValue: this.config.fsPath},
            {provide: 'redis.host', useValue: this.config.redisHost},
            {provide: 'redis.port', useValue: this.config.redisPort},
            {provide: 'redis.prefix', useValue: this.config.redisPrefix},
            {provide: Application, useClass: application},
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
            {provide: Injector, useFactory: () => this.injector},
        ];

        baseInjectors.push(...serverProvider);

        this.injector = ReflectiveInjector.resolveAndCreate(baseInjectors);
    }

    public static createForModule<T extends Application>(application: ClassType<T>) {
        const options = getApplicationModuleOptions(application);

        return new this(options.config || {}, options.serverProviders || [], options.connectionProviders || [], application);
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
