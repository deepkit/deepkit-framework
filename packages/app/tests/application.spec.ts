import { t } from '@deepkit/type';
import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { CommandApplication } from '../src/application';
import { inject } from '@deepkit/injector';
import { AppModule, AppModuleConfig } from '../src/module';
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

const baseModule = new AppModule({ config: baseConfig, providers: [BaseService] }, 'base').forRoot();

const config = new AppModuleConfig({
    token: t.string.default('notSet'),
});

class Service {
    constructor(@inject(config.token('token')) public token: string) {
    }
}

test('loadConfigFromEnvVariables', async () => {
    process.env.APP_token = 'changed1';
    process.env.APP_base_db = 'changed2';
    const app = new CommandApplication(new AppModule({ config, providers: [Service], imports: [baseModule] }));
    app.loadConfigFromEnvVariables('APP_');

    const service = app.get(Service);
    expect(service.token).toBe('changed1');

    const baseService = app.get(BaseService);
    expect(baseService.db).toBe('changed2');
});

test('loadConfigFromEnvVariable', async () => {
    process.env.APP_CONFIG = JSON.stringify({
        token: 'changed3',
        base: {
            db: 'changed4'
        }
    });
    const app = new CommandApplication(new AppModule({ config, providers: [Service], imports: [baseModule] }));
    app.loadConfigFromEnvVariable('APP_CONFIG');

    const service = app.get(Service);
    expect(service.token).toBe('changed3');

    const baseService = app.get(BaseService);
    expect(baseService.db).toBe('changed4');
});

test('loadConfigFromEnvFile', async () => {
    const app = new CommandApplication(new AppModule({ config, providers: [Service], imports: [baseModule] }));
    app.loadConfigFromEnvFile(__dirname + '/test.env');

    const service = app.get(Service);
    expect(service.token).toBe('changed5');

    const baseService = app.get(BaseService);
    expect(baseService.db).toBe('changed6');
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
    process.env.APP_base_db = 'changed2';
    app.loadConfigFromEnvVariables('APP_');

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
            expect(config.log).toBe(true);
        })
    ;

    process.env['APP_log'] = 'asdf';

    const app = new CommandApplication(new AppModule({ imports: [baseModule] }));
    app.loadConfigFromEnvVariables('APP_');
    expect(() => app.serviceContainer.process()).toThrow('No Boolean given');
});

test('required value can be set via env or setupConfig', async () => {
    const baseConfig = new AppModuleConfig({
        log: t.boolean,
    });

    const baseModule = new AppModule({ config: baseConfig, providers: [BaseService] })
        .setup((module, config) => {
            expect(config.log).toBe(true);
        })
    ;

    {
        baseModule.clearConfig();
        const app = new CommandApplication(new AppModule({ imports: [baseModule] }));
        expect(() => app.serviceContainer.process()).toThrow('log(required): Required value is undefined');
    }

    {
        baseModule.clearConfig();
        const app = new CommandApplication(new AppModule({
            imports: [baseModule.setupConfig((module, config) => {
                config.log = true;
            })]
        }));
        app.serviceContainer.process();
    }

    {
        baseModule.clearConfig();
        process.env['APP_log'] = '1';
        const app = new CommandApplication(new AppModule({ imports: [baseModule] }));
        app.loadConfigFromEnvVariables('APP_');
        app.serviceContainer.process();
    }

    {
        baseModule.clearConfig();
        process.env['APP_log'] = 'asdf';

        const app = new CommandApplication(new AppModule({ imports: [baseModule] }));
        app.loadConfigFromEnvVariables('APP_');
        expect(() => app.serviceContainer.process()).toThrow('No Boolean given');
    }

    {
        baseModule.clearConfig();
        process.env['APP_CONFIG'] = '{}';

        const app = new CommandApplication(new AppModule({ imports: [baseModule] }));
        app.loadConfigFromEnvVariable('APP_CONFIG');
        expect(() => app.serviceContainer.process()).toThrow('log(required): Required value is undefined');
    }

    {
        baseModule.clearConfig();
        process.env['APP_CONFIG'] = '{"log": true}';

        const app = new CommandApplication(new AppModule({ imports: [baseModule] }));
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
    process.env.APP_base_log = '1';
    app.loadConfigFromEnvVariables('APP_');

    app.serviceContainer.process();
});

test('config uppercase naming strategy', async () => {
    const config = new AppModuleConfig({
        dbHost: t.string,
    });

    const app = new CommandApplication(new AppModule({config})).setup((module, config) => {
        expect(config.dbHost).toBe('mongodb://localhost');
    });
    process.env.APP_DB_HOST = 'mongodb://localhost';
    app.loadConfigFromEnvVariables('APP_', 'upper');

    app.serviceContainer.process();
});

test('config lowercase naming strategy', async () => {
    const config = new AppModuleConfig({
        dbHost: t.string,
    });

    const app = new CommandApplication(new AppModule({config})).setup((module, config) => {
        expect(config.dbHost).toBe('mongodb://localhost');
    });
    process.env.app_db_host = 'mongodb://localhost';
    app.loadConfigFromEnvVariables('app_', 'lower');

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
