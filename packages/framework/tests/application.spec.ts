
import { t } from '@deepkit/type';
import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { Application } from '../src/application';
import { createConfig, inject } from '../src/injector/injector';
import { createModule } from '../src/module';

const baseConfig = createConfig({
    db: t.string.default('notSet'),
});

class BaseService {
    constructor(@inject(baseConfig.token('db')) public db: string) { }
}
const baseModule = createModule({ name: 'base', config: baseConfig, providers: [BaseService] }).forRoot();

const config = createConfig({
    token: t.string.default('notSet'),
});

class Service {
    constructor(@inject(config.token('token')) public token: string) { }
}

test('loadConfigFromEnvVariables', async () => {
    process.env.APP_token = 'changed1';
    process.env.APP_base_db = 'changed2';
    const app = new Application(createModule({ config, providers: [Service], imports: [baseModule] }));
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
    const app = new Application(createModule({ config, providers: [Service], imports: [baseModule] }));
    app.loadConfigFromEnvVariable('APP_CONFIG');

    const service = app.get(Service);
    expect(service.token).toBe('changed3');

    const baseService = app.get(BaseService);
    expect(baseService.db).toBe('changed4');
});

test('loadConfigFromEnvFile', async () => {
    const app = new Application(createModule({ config, providers: [Service], imports: [baseModule] }));
    app.loadConfigFromEnvFile(__dirname + '/test.env');

    const service = app.get(Service);
    expect(service.token).toBe('changed5');

    const baseService = app.get(BaseService);
    expect(baseService.db).toBe('changed6');
});

test('loadConfigFromEnvVariables non-root import', async () => {
    const baseConfig = createConfig({
        db: t.string.default('notSet'),
    });

    class BaseService {
        constructor(@inject(baseConfig.token('db')) public db: string) { }
    }
    const baseModule = createModule({ name: 'base', config: baseConfig, providers: [BaseService] });
    const app = new Application(createModule({ imports: [baseModule] }));
    process.env.APP_base_db = 'changed2';
    app.loadConfigFromEnvVariables('APP_');

    const baseService = app.serviceContainer.getInjectorFor(baseModule).get(BaseService);
    expect(baseService.db).toBe('changed2');
});