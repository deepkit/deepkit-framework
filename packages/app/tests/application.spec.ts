import { t } from '@deepkit/type';
import { beforeEach, expect, test } from '@jest/globals';
import 'reflect-metadata';
import { CommandApplication } from '../src/application';
import { inject } from '@deepkit/injector';
import { AppModule, AppModuleConfig, createModule } from '../src/module';
import { BaseEvent, EventDispatcher, eventDispatcher, EventToken } from '@deepkit/event';
import { cli, Command } from '../src/command';

Error.stackTraceLimit = 100;

const baseConfig = new AppModuleConfig({
    db: t.string.default('notSet'),
});

class BaseService {
    constructor(@inject(baseConfig.token('db')) public db: string) {
    }
}

class BaseModule extends createModule({ config: baseConfig, providers: [BaseService] }, 'base') {
    root = true;
}

const config = new AppModuleConfig({
    token: t.string.default('notSet'),
});

class Service {
    constructor(@inject(config.token('token')) public token: string) {
    }
}

beforeEach(() => {
    process.env = {};
});

test('loadConfigFromEnvVariables', async () => {
    process.env.APP_TOKEN = 'fromBefore';
    process.env.APP_BASE_DB = 'changed2';
    const app = new CommandApplication(new AppModule({ config, providers: [Service], imports: [new BaseModule] }));
    app.loadConfigFromEnv();

    const service = app.get(Service);
    expect(service.token).toBe('fromBefore');

    const baseModule = app.serviceContainer.getModuleForModuleClass(BaseModule);
    expect(baseModule.getConfig()).toEqual({db: 'changed2'});

    const baseService = app.get(BaseService);
    expect(baseService.db).toBe('changed2');
});

test('loadConfigFromEnvFile', async () => {
    const app = new CommandApplication(new AppModule({ config, providers: [Service], imports: [new BaseModule] }));
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
    const app = new CommandApplication(new AppModule({ config, providers: [Service], imports: [new BaseModule] }));
    app.loadConfigFromEnvVariable('APP_CONFIG');

    const service = app.get(Service);
    expect(service.token).toBe('changed3');

    const baseService = app.get(BaseService);
    expect(baseService.db).toBe('changed4');
});

test('loadConfigFromEnvVariables non-root import', async () => {
    const baseConfig = new AppModuleConfig({
        db: t.string.default('notSet'),
    });

    class BaseService {
        constructor(@inject(baseConfig.token('db')) public db: string) {
        }
    }

    const baseModule = new AppModule({ config: baseConfig, providers: [BaseService] }, 'base');
    const app = new CommandApplication(new AppModule({ imports: [baseModule] }));
    process.env.APP_BASE_DB = 'changed2';
    app.loadConfigFromEnv();

    const baseService = app.serviceContainer.getInjectorFor(baseModule).get(BaseService);
    expect(baseService.db).toBe('changed2');
});

test('validation fails when setupConfig sets wrong values', async () => {
    const baseConfig = new AppModuleConfig({
        log: t.boolean.default(false),
    });

    const baseModule = new AppModule({ config: baseConfig, providers: [BaseService] })
        .setupConfig((module, config) => {
            (config as any).log = 'asda';
        })
        .setup((module, config) => {
            expect(config.log).toBe(true);
        })
    ;

    const app = new CommandApplication(new AppModule({ imports: [baseModule] }));
    expect(() => app.serviceContainer.process()).toThrow('No Boolean given');
});

test('validation fails when env is wrong', async () => {
    const baseConfig = new AppModuleConfig({
        log: t.boolean.default(false),
    });

    const baseModule = new AppModule({ config: baseConfig, providers: [BaseService] })
        .setup((module, config) => {
            if (!config.log) throw new Error('log needs to be true');
        })
    ;

    process.env['APP_log'] = 'asdf';

    const app = new CommandApplication(new AppModule({ imports: [baseModule] }));
    app.loadConfigFromEnv();
    expect(() => app.serviceContainer.process()).toThrow('log needs to be true');
});

test('required value can be set via env or setupConfig', async () => {
    const baseConfig = new AppModuleConfig({
        log: t.boolean,
    });

    class BaseModule extends createModule({ config: baseConfig, providers: [BaseService] }, 'base') {
        process() {
            if (!this.config.log) throw new Error('log needs to be true');
        }
    }

    {
        const app = new CommandApplication(new AppModule({ imports: [new BaseModule()] }));
        expect(() => app.serviceContainer.process()).toThrow('log(required): Required value is undefined');
    }

    {
        const app = new CommandApplication(new AppModule({
            imports: [new BaseModule().setupConfig((module, config) => {
                config.log = true;
            })]
        }));
        app.serviceContainer.process();
    }

    {
        process.env['APP_BASE_LOG'] = '1';
        const app = new CommandApplication(new AppModule({ imports: [new BaseModule()] }));
        app.loadConfigFromEnv();
        app.serviceContainer.process();
    }

    {
        process.env['APP_BASE_LOG'] = 'asdf';

        const app = new CommandApplication(new AppModule({ imports: [new BaseModule()] }));
        app.loadConfigFromEnv();
        expect(() => app.serviceContainer.process()).toThrow('log(invalid_boolean): No Boolean given');
    }

    {
        process.env['APP_CONFIG'] = '{}';

        const app = new CommandApplication(new AppModule({ imports: [new BaseModule()] }));
        app.loadConfigFromEnvVariable('APP_CONFIG');
        expect(() => app.serviceContainer.process()).toThrow('log(required): Required value is undefined');
    }

    {
        process.env['APP_CONFIG'] = '{"base": {"log": true}}';

        const app = new CommandApplication(new AppModule({ imports: [new BaseModule()] }));
        app.loadConfigFromEnvVariable('APP_CONFIG');
        app.serviceContainer.process();
    }
});

test('loadConfigFromEnvVariables() happens before setup() calls', async () => {
    const baseConfig = new AppModuleConfig({
        log: t.boolean.default(false),
    });

    const baseModule = new AppModule({ config: baseConfig, providers: [BaseService] }, 'base')
        .setup((module, config) => {
            expect(config.log).toBe(true);
        });

    const app = new CommandApplication(new AppModule({ imports: [baseModule] }));
    process.env.APP_BASE_LOG = '1';
    app.loadConfigFromEnv();

    app.serviceContainer.process();
});

test('config uppercase naming strategy', async () => {
    const config = new AppModuleConfig({
        dbHost: t.string,
    });

    const app = new CommandApplication(new AppModule({ config })).setup((module, config) => {
        expect(config.dbHost).toBe('mongodb://localhost');
    });
    process.env.APP_DB_HOST = 'mongodb://localhost';
    app.loadConfigFromEnv();

    app.serviceContainer.process();
});

test('config lowercase naming strategy', async () => {
    const config = new AppModuleConfig({
        dbHost: t.string,
    });

    const app = new CommandApplication(new AppModule({ config })).setup((module, config) => {
        expect(config.dbHost).toBe('mongodb://localhost');
    });
    process.env.app_db_host = 'mongodb://localhost';
    app.loadConfigFromEnv({ namingStrategy: 'lower', prefix: 'app_' });

    app.serviceContainer.process();
});

test('loadConfigFromEnvVariable() happens before setup() calls', async () => {
    const baseConfig = new AppModuleConfig({
        log: t.boolean.default(false),
    });

    const baseModule = new AppModule({ config: baseConfig, providers: [BaseService] }, 'base')
        .setup((module, config) => {
            expect(config.log).toBe(true);
        });

    {
        const app = new CommandApplication(new AppModule({ imports: [baseModule] }));
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
    const app = new CommandApplication(new AppModule({ imports: [myModule] }));
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
    const app = new CommandApplication(new AppModule({ imports: [myModule] }));
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
        constructor(private service: MyService, @inject('onlyInCLI') protected yes: boolean) {
            created++;
        }

        execute(): number {
            if (!this.yes) return 10;
            return this.service.doIt();
        }
    }

    const myModule = new AppModule({
        providers: [MyService, { provide: 'onlyInCLI', scope: 'cli', useValue: true }],
        controllers: [MyController],
    }, 'base');

    {
        const app = new CommandApplication(new AppModule({ imports: [myModule] }));

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

        expect(() => app.get(MyService)).toThrow('Could not resolve injector token MyService');
    }

    {
        const app = new CommandApplication(new AppModule({
            imports: [myModule.setup((module) => {
                module.addProvider({ provide: 'onlyInCLI', scope: 'cli', useValue: false });
            })]
        }));
        const res = await app.execute(['test']);
        expect(res).toBe(10);
    }
});

test('config deps and @inject() in FactoryProvider', async () => {

    const config = new AppModuleConfig({
        host: t.string.default('0.0.0.0'),
    });

    class MyClass {
        constructor(public readonly host: string) {
        }
    }

    class MyClassConfig extends config.slice('host') {
    }

    class Unknown {
    }

    const module = new AppModule({
        config,
        providers: [
            {
                provide: MyClass, deps: [MyClassConfig], useFactory(config: MyClassConfig) {
                    return new MyClass(config.host);
                }
            },
            {
                provide: 'myToken', deps: [inject(Unknown).optional], useFactory(config?: Unknown) {
                    return !!config;
                }
            },
            {
                provide: 'myToken2', deps: [inject(MyClassConfig).optional], useFactory(config: MyClassConfig) {
                    return config instanceof MyClassConfig;
                }
            },
            {
                provide: 'myToken3', deps: [inject(MyClassConfig)], useFactory(config: MyClassConfig) {
                    return config instanceof MyClassConfig;
                }
            },
            {
                provide: 'myToken4', deps: [inject(Unknown).optional, MyClassConfig], useFactory(unknown: Unknown | undefined, config: MyClassConfig) {
                    return [!!unknown, config instanceof MyClassConfig];
                }
            },
            {
                provide: 'configHost', deps: [config.token('host')], useFactory(host: string) {
                    return host;
                }
            },
            {
                provide: 'configHost2', deps: [config.all()], useFactory(c: typeof config.type) {
                    return c.host;
                }
            },
            {
                provide: 'configHost3', deps: [inject(config.all())], useFactory(c: typeof config.type) {
                    return c.host;
                }
            }
        ]
    });

    {
        const app = new CommandApplication(module);
        expect(app.get(MyClass).host).toBe('0.0.0.0');

        expect(app.get('myToken')).toBe(false);

        expect(app.get('myToken2')).toBe(true);

        expect(app.get('myToken3')).toBe(true);

        expect(app.get('myToken4')).toEqual([false, true]);

        expect(app.get('configHost')).toEqual('0.0.0.0');

        expect(app.get('configHost2')).toEqual('0.0.0.0');

        expect(app.get('configHost3')).toEqual('0.0.0.0');
    }

    {
        const module = new AppModule({
            providers: [
                {
                    provide: 'undefinedDep', deps: [undefined], useFactory(host: string) {
                        return host;
                    }
                },
            ]
        });
        const app = new CommandApplication(module);
        expect(() => app.get('undefinedDep')).toThrow(`No token defined for dependency 0 in 'deps' of useFactory for undefinedDep`);
    }
});
