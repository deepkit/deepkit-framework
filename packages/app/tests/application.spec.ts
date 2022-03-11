import { beforeEach, expect, test } from '@jest/globals';
import { App } from '../src/app';
import { Inject, ProviderWithScope, Token } from '@deepkit/injector';
import { AppModule, createModule } from '../src/module';
import { BaseEvent, EventDispatcher, eventDispatcher, EventToken } from '@deepkit/event';
import { cli, Command } from '../src/command';
import { ClassType } from '../../core';
import { isClass } from '@deepkit/core';
import { ServiceContainer } from '../src/service-container';

Error.stackTraceLimit = 100;

class BaseConfig {
    db: string = 'notSet';
}
class BaseService {
    constructor(public db: BaseConfig['db']) {
    }
}

class BaseModule extends createModule({ config: BaseConfig, providers: [BaseService] }, 'base') {
    root = true;
}

class Config {
    token: string = 'notSet';
}

class Service {
    constructor(public token: Config['token']) {
    }
}

beforeEach(() => {
    process.env = {};
});

test('loadConfigFromEnvVariables', async () => {
    process.env.APP_TOKEN = 'fromBefore';
    process.env.APP_BASE_DB = 'changed2';
    const app = new App({ config: Config, providers: [Service], imports: [new BaseModule] });
    app.loadConfigFromEnv();

    const service = app.get(Service);
    expect(service.token).toBe('fromBefore');

    const baseModule = app.serviceContainer.getModule(BaseModule);
    expect(baseModule.getConfig()).toEqual({ db: 'changed2' });

    const baseService = app.get(BaseService);
    expect(baseService.db).toBe('changed2');
});

test('loadConfigFromEnvFile', async () => {
    const app = new App({ config: Config, providers: [Service], imports: [new BaseModule] });
    app.loadConfigFromEnv({ envFilePath: __dirname + '/test.env' });

    const service = app.get(Service);
    expect(service.token).toBe('changed5');

    const baseService = app.get(BaseService);
    expect(baseService.db).toBe('changed6');
});

test('loadConfigFromEnvVariable', async () => {
    process.env.APP_CONFIG = JSON.stringify({
        token: 'changed3',
        base: {
            db: 'changed4'
        }
    });
    const app = new App({ config: Config, providers: [Service], imports: [new BaseModule] });
    app.loadConfigFromEnvVariable('APP_CONFIG');

    const service = app.get(Service);
    expect(service.token).toBe('changed3');

    const baseService = app.get(BaseService);
    expect(baseService.db).toBe('changed4');
});

test('loadConfigFromEnvVariables non-root import', async () => {
    class BaseConfig {
        db: string = 'notSet';
    }

    class BaseService {
        constructor(public db: BaseConfig['db']) {
        }
    }

    const baseModule = new AppModule({ config: BaseConfig, providers: [BaseService] }, 'base');
    const app = new App({ imports: [baseModule] });
    process.env.APP_BASE_DB = 'changed2';
    app.loadConfigFromEnv();

    const baseService = app.serviceContainer.getInjector(baseModule).get(BaseService);
    expect(baseService.db).toBe('changed2');
});

test('validation fails when setupConfig sets wrong values', async () => {
    class BaseConfig {
        log: boolean = false;
    }

    const baseModule = new AppModule({ config: BaseConfig, providers: [BaseService] })
        .setupConfig((module, config) => {
            (config as any).log = 'asda';
        })
        .setup((module, config) => {
            expect(config.log).toBe(true);
        })
    ;

    const app = new App({ imports: [baseModule] });
    expect(() => app.serviceContainer.process()).toThrow('log(type): Not a boolean');
});

test('validation fails when env is wrong', async () => {
    class BaseConfig {
        log: boolean = false;
    }

    const baseModule = new AppModule({ config: BaseConfig, providers: [BaseService] })
        .setup((module, config) => {
            if (!config.log) throw new Error('log needs to be true');
        })
    ;

    process.env['APP_log'] = 'asdf';

    const app = new App({ imports: [baseModule] });
    app.loadConfigFromEnv();
    expect(() => app.serviceContainer.process()).toThrow('log needs to be true');
});

test('required value can be set via env or setupConfig', async () => {
    class BaseConfig {
        log!: boolean;
    }

    class BaseModule extends createModule({ config: BaseConfig }, 'base') {
        process() {
            if (!this.config.log) throw new Error('log needs to be true');
        }
    }

    {
        const app = new App({ imports: [new BaseModule()] });
        expect(() => app.serviceContainer.process()).toThrow('base.log(type): Not a boolean');
    }

    {
        const app = new App({
            imports: [new BaseModule().setupConfig((module, config) => {
                config.log = true;
            })]
        });
        app.serviceContainer.process();
    }

    {
        process.env['APP_BASE_LOG'] = '1';
        const app = new App({ imports: [new BaseModule()] });
        app.loadConfigFromEnv();
        app.serviceContainer.process();
    }

    {
        //will be converted to false
        process.env['APP_BASE_LOG'] = 'asdf';

        const app = new App({ imports: [new BaseModule()] });
        app.loadConfigFromEnv();
        expect(() => app.serviceContainer.process()).toThrow('log needs to be true');
    }

    {
        process.env['APP_CONFIG'] = '{}';

        const app = new App({ imports: [new BaseModule()] });
        app.loadConfigFromEnvVariable('APP_CONFIG');
        expect(() => app.serviceContainer.process()).toThrow('base.log(type): Not a boolean');
    }

    {
        process.env['APP_CONFIG'] = '{"base": {"log": true}}';

        const app = new App({ imports: [new BaseModule()] });
        app.loadConfigFromEnvVariable('APP_CONFIG');
        app.serviceContainer.process();
    }
});

test('loadConfigFromEnvVariables() happens before setup() calls', async () => {
    class BaseConfig {
        log: boolean = false;
    }

    const baseModule = new AppModule({ config: BaseConfig }, 'base')
        .setup((module, config) => {
            expect(config.log).toBe(true);
        });

    const app = new App({ imports: [baseModule] });
    process.env.APP_BASE_LOG = '1';
    app.loadConfigFromEnv();

    app.serviceContainer.process();
});

test('config uppercase naming strategy', async () => {
    class Config {
        dbHost!: string
    }

    const app = new App({ config: Config }).setup((module, config) => {
        expect(config.dbHost).toBe('mongodb://localhost');
    });
    process.env.APP_DB_HOST = 'mongodb://localhost';
    app.loadConfigFromEnv();

    app.serviceContainer.process();
});

test('config lowercase naming strategy', async () => {
    class Config {
        dbHost!: string;
    }

    const app = new App({ config: Config }).setup((module, config) => {
        expect(config.dbHost).toBe('mongodb://localhost');
    });
    process.env.app_db_host = 'mongodb://localhost';
    app.loadConfigFromEnv({ namingStrategy: 'lower', prefix: 'app_' });

    app.serviceContainer.process();
});

test('loadConfigFromEnvVariable() happens before setup() calls', async () => {
    class BaseConfig {
        log: boolean = false;
    }

    const baseModule = new AppModule({ config: BaseConfig }, 'base')
        .setup((module, config) => {
            expect(config.log).toBe(true);
        });

    {
        const app = new App({ imports: [baseModule] });
        process.env.APP_CONFIG = '{"base": {"log": true}}';
        app.loadConfigFromEnvVariable('APP_CONFIG');

        app.serviceContainer.process();
    }
});

test('non-forRoot module with class listeners works without exports', async () => {
    const myEvent = new EventToken('my-event');

    let executed = false;

    class Listener {
        @eventDispatcher.listen(myEvent)
        boostrap() {
            executed = true;
        }
    }

    const myModule = new AppModule({ listeners: [Listener] }, 'base');
    const app = new App({ imports: [myModule] });
    await app.get(EventDispatcher).dispatch(myEvent, new BaseEvent());
    expect(executed).toBe(true);
});

test('non-forRoot module with fn listeners works without exports', async () => {
    const myEvent = new EventToken('my-event');

    let executed = false;
    const myModule = new AppModule({
        listeners: [myEvent.listen(() => {
            executed = true;
        })]
    }, 'base');
    const app = new App({ imports: [myModule] });
    await app.get(EventDispatcher).dispatch(myEvent, new BaseEvent());
    expect(executed).toBe(true);
});

test('cli controllers in sub modules are in correct injector context', async () => {
    class MyService {
        doIt() {
            return 5;
        }
    }

    let created = 0;

    @cli.controller('test')
    class MyController implements Command {
        constructor(private service: MyService, protected yes: Inject<boolean, 'onlyInCLI'>) {
            created++;
        }

        execute(): number {
            if (!this.yes) return 10;
            return this.service.doIt();
        }
    }

    class MyModule extends createModule({
        providers: [MyService, { provide: 'onlyInCLI', scope: 'cli', useValue: true }],
        controllers: [MyController],
    }, 'base') {
    }

    {
        const app = new App({ imports: [new MyModule] });

        {
            const res = await app.execute(['test']);
            expect(res).toBe(5);
            expect(created).toBe(1);
        }
        {
            const res = await app.execute(['test']);
            expect(res).toBe(5);
            expect(created).toBe(2);
        }

        expect(() => app.get(MyService)).toThrow('not found');
    }

    {
        const app = new App({
            imports: [new MyModule().setup((module) => {
                module.addProvider({ provide: 'onlyInCLI', scope: 'cli', useValue: false });
            })]
        });
        const res = await app.execute(['test']);
        expect(res).toBe(10);
    }
});

test('config deps and @inject() in FactoryProvider', async () => {
    class Config {
        host: string = '0.0.0.0';
    }

    class MyClass {
        constructor(public readonly host: string) {
        }
    }

    type MyClassConfig = Pick<Config, 'host'>;

    class Unknown {
    }

    const module = new AppModule({
        config: Config,
        providers: [
            {
                provide: MyClass, useFactory(config: MyClassConfig) {
                    return new MyClass(config.host);
                }
            },
            {
                provide: 'configHost', useFactory(host: Config['host']) {
                    return host;
                }
            },
        ]
    });

    {
        const app = App.fromModule(module);
        expect(app.get(MyClass).host).toBe('0.0.0.0');

        expect(app.get('configHost')).toEqual('0.0.0.0');
    }

    {
        const module = new AppModule({
            providers: [
                {
                    provide: 'undefinedDep', useFactory(host: string) {
                        return host;
                    }
                },
            ]
        });
        const app = App.fromModule(module);
        expect(() => app.get('undefinedDep')).toThrow(`Undefined dependency "host: string" of useFactory(?). Type has no provider`);
    }
});


test('service container hooks', () => {
    class MyModule extends createModule({}) {
        providersFound: ProviderWithScope[] = [];
        controllersFound: ClassType[] = [];

        processController(module: AppModule<any>, controller: ClassType) {
            expect(module).toBeInstanceOf(AppModule);
            expect(isClass(controller)).toBe(true);
            module.addProvider(controller);
            this.controllersFound.push(controller);
        }

        processProvider(module: AppModule<any>, token: Token, provider: ProviderWithScope) {
            expect(module).toBeInstanceOf(AppModule);
            this.providersFound.push(provider);
        }
    }

    {
        const m = new MyModule;
        const app = new ServiceContainer(new AppModule({ imports: [m] }));
        app.process();
        expect(m.providersFound.length).toBe(5); //5 is the default, as the ServiceContainer adds default services
        expect(m.controllersFound.length).toBe(0);
    }

    {
        class Controller {
        }

        const m = new MyModule;
        const app = new ServiceContainer(new AppModule({ controllers: [Controller], imports: [m] }));
        app.process();
        expect(m.providersFound.length).toBe(6);
        expect(m.controllersFound.length).toBe(1);
    }

    {
        class Controller {
        }

        const m = new MyModule;
        const app = new ServiceContainer(new AppModule({ providers: [Controller], imports: [m] }));
        app.process();
        expect(m.providersFound.length).toBe(6);
        expect(m.controllersFound.length).toBe(0);
    }

    {
        class Controller {
        }

        class Service {
        }

        const baseModule = new AppModule({
            controllers: [Controller],
            providers: [Service]
        });

        const m = new MyModule;
        const app = new ServiceContainer(new AppModule({ imports: [baseModule, m] }));
        app.process();
        expect(m.providersFound.length).toBe(7);
        expect(m.controllersFound.length).toBe(1);
    }
});

test('App.get generic', () => {
    interface Service {
        add(): void;
    }

    const app = new App({
        providers: [{
            provide: 'service', useClass: class {
                add() {
                }
            }
        }]
    });

    const service = app.get<Service>('service' as any);
    service.add();
});
