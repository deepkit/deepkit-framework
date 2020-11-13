import 'jest';
import 'reflect-metadata';
import {t} from '@deepkit/type';
import {ConfigSlice, createConfig, inject, injectable} from '../src/injector/injector';
import {createModule, Module} from '../src/module';
import {ServiceContainer} from '../src/service-container';
import {ClassType} from '@deepkit/core';

test('basic module config', () => {
    const AppModuleConfig = createConfig({
        database: t.string.default('mongodb://localhost/my-app'),
        debug: t.boolean.default(false),
    });

    class MyServiceConfig extends AppModuleConfig.slice('debug') {}
    const debugConfigToken = AppModuleConfig.token('debug');

    class P extends ConfigSlice<any> {
        constructor() {
            super({} as any, [] as any);
        }
    }
    expect(Object.getPrototypeOf(Object.getPrototypeOf(MyServiceConfig)) === ConfigSlice).toBe(true);

    @injectable()
    class MyService {
        constructor(private config: MyServiceConfig) {
        }

        isDebug(): boolean {
            return this.config.debug;
        }
    }

    new MyService({debug: true});

    @injectable()
    class MyService2 {
        constructor(@inject(debugConfigToken) public debug: boolean) {
        }
    }

    const AppModule = createModule({
        providers: [
            MyService,
            MyService2,
        ],
        imports: [
            // DatabaseModule.configured({databases: [MyDatabase]}),
            // KernelModule,
            //
            // CmsModule.configured({
            //     database: MyDatabase,
            // })
        ],
        config: AppModuleConfig,
        // config: {
        //     debug: t.boolean,
        // },
    });

    // Application.create(AppModule).configure({
    //     // app: {
    //     //     database: 'mongodb://localhost/my-app',
    //     // },
    //     // database: {
    //     //     migrateOnStartup: true,
    //     // },
    //     // kernel: {
    //     //     debug: false,
    //     //     host: 'localhost',
    //     //     port: 1234
    //     // }
    // }).run();
    //
    // Application.create(AppModule).loadConfigFromEnvFile('.env').run();
    // Application.create(AppModule).loadConfigFromEnvVariables().run();
    // Application.create(AppModule).loadConfigFromEnvVariable('APP_CONFIG').run();

    function getMyServiceFor<T>(module: Module<any>, service: ClassType<T>): T {
        const serviceContainer = new ServiceContainer();
        serviceContainer.processRootModule(module);
        return serviceContainer.getRootContext().getInjector().get(service);
    }

    {
        expect(() => getMyServiceFor(AppModule, MyService)).toThrow('Unmet configuration dependency debug');
    }

    {
        expect(() => getMyServiceFor(AppModule, MyService2)).toThrow('Unmet configuration dependency debug');
    }

    {
        const myService = getMyServiceFor(AppModule.configured({
            debug: false
        }), MyService);
        expect(myService.isDebug()).toBe(false);
    }

    {
        const myService = getMyServiceFor(AppModule.configured({
            debug: true
        }), MyService);
        expect(myService.isDebug()).toBe(true);
    }
});
