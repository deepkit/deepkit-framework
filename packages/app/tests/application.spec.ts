import { t } from '@deepkit/type';
import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { CommandApplication } from '../src/application';
import { inject } from '@deepkit/injector';
import { AppModule, AppModuleConfig } from '../src/module';

const baseConfig = new AppModuleConfig({
    db: t.string.default('notSet'),
});

class BaseService {
    constructor(@inject(baseConfig.token('db')) public db: string) { }
}
const baseModule = new AppModule({ config: baseConfig, providers: [BaseService] }, 'base').forRoot();

const config = new AppModuleConfig({
    token: t.string.default('notSet'),
});

class Service {
    constructor(@inject(config.token('token')) public token: string) { }
}

test('loadConfigFromEnvVariables', async () => {
    process.env.APP_token = 'changed1';
    process.env.APP_base_db = 'changed2';
    const app = new CommandApplication(new AppModule({ config, providers: [Service], imports: [baseModule] }, 'app'));
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
    const app = new CommandApplication(new AppModule({ config, providers: [Service], imports: [baseModule] }, 'app'));
    app.loadConfigFromEnvVariable('APP_CONFIG');

    const service = app.get(Service);
    expect(service.token).toBe('changed3');

    const baseService = app.get(BaseService);
    expect(baseService.db).toBe('changed4');
});

test('loadConfigFromEnvFile', async () => {
    const app = new CommandApplication(new AppModule({ config, providers: [Service], imports: [baseModule] }, 'app'));
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
        constructor(@inject(baseConfig.token('db')) public db: string) { }
    }
    const baseModule = new AppModule({config: baseConfig, providers: [BaseService] }, 'base');
    const app = new CommandApplication(new AppModule({ imports: [baseModule] }));
    process.env.APP_base_db = 'changed2';
    app.loadConfigFromEnvVariables('APP_');

    const baseService = app.serviceContainer.getInjectorFor(baseModule).get(BaseService);
    expect(baseService.db).toBe('changed2');
});
