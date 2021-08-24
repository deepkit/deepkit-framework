import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { t } from '@deepkit/type';
import { ConfigSlice, inject, injectable, injectorReference } from '@deepkit/injector';
import { ServiceContainer } from '../src/service-container';
import { ClassType } from '@deepkit/core';
import { AppModule, AppModuleConfig, createModule, createModuleConfig } from '../src/module';

const myModuleConfig = new AppModuleConfig({
    param1: t.string.minLength(5),
    param2: t.number.minimum(100)
});

class MyModuleConfigFull extends myModuleConfig.all() {
}

@injectable()
class ModuleService {
    constructor(public readonly config: MyModuleConfigFull) {
    }
}

class MyModule extends createModule({
    config: myModuleConfig,
    providers: [
        ModuleService
    ],
    exports: [ModuleService]
}, 'myModule') {
}

const appModuleConfig = new AppModuleConfig({
    database: t.string.default('mongodb://localhost/my-app'),
    debug: t.boolean.default(false),
});

class MyServiceConfig extends appModuleConfig.slice('debug') {
}

const debugConfigToken = appModuleConfig.token('debug');

expect(Object.getPrototypeOf(Object.getPrototypeOf(MyServiceConfig)) === ConfigSlice).toBe(true);

@injectable()
class MyService {
    constructor(private config: MyServiceConfig) {
    }

    isDebug(): boolean {
        return this.config.debug;
    }
}

@injectable()
class MyService2 {
    constructor(@inject(debugConfigToken) public debug: boolean) {
    }
}

class MyAppModule extends createModule({
    providers: [
        MyService,
        MyService2,
    ],
    imports: [
        new MyModule,
    ],
    config: appModuleConfig,
}) {
}

function getServiceOnNewServiceContainer<T>(module: AppModule<any>, service: ClassType<T>): T {
    const serviceContainer = new ServiceContainer(module);
    return serviceContainer.getRootInjectorContext().get(service);
}

test('loadConfig', () => {
    // Application.create(AppModule).loadConfigFromEnvFile('.env').run();
    // Application.create(AppModule).loadConfigFromEnvVariables().run();
    // Application.create(AppModule).loadConfigFromEnvVariable('APP_CONFIG').run();
});

test('import', () => {
    // {
    //     expect(() => getMyServiceFor(new MyAppModule, ModuleService)).toThrow(
    //         'Configuration for module myModule is invalid. Make sure the module is correctly configured. Error: myModule.param1(required): Required value is undefined, myModule.param2(required): Required value is undefined'
    //     );
    // }

    {
        expect(() => getServiceOnNewServiceContainer(new MyAppModule({ myModule: { param1: '23' } }), ModuleService)).toThrow(
            'Configuration for module myModule is invalid. Make sure the module is correctly configured. Error: myModule.param1(minLength): Min length is 5, myModule.param2(required): Required value is undefined'
        );
    }

    {
        expect(() => getServiceOnNewServiceContainer(new MyAppModule({ myModule: { param1: '12345' } }), ModuleService)).toThrow(
            'Configuration for module myModule is invalid. Make sure the module is correctly configured. Error: myModule.param2(required): Required value is undefined'
        );
    }

    {
        expect(() => getServiceOnNewServiceContainer(new MyAppModule({ myModule: { param1: '12345', param2: 55 } }), ModuleService)).toThrow(
            'Configuration for module myModule is invalid. Make sure the module is correctly configured. Error: myModule.param2(minimum): Number needs to be greater than or equal to 100'
        );
    }

    {
        expect(() => getServiceOnNewServiceContainer(new MyAppModule({ myModule: { param1: '12345', param2: '55' } }), ModuleService)).toThrow(
            'Configuration for module myModule is invalid. Make sure the module is correctly configured. Error: myModule.param2(minimum): Number needs to be greater than or equal to 100'
        );
    }

    {
        const myService = getServiceOnNewServiceContainer(new MyAppModule({ myModule: { param1: '12345', param2: 100 } }), ModuleService);
        expect(myService.config).toEqual({ param1: '12345', param2: 100 });
    }

    {
        //@deepkit/type does automatically soft-type casting
        const myService = getServiceOnNewServiceContainer(new MyAppModule({ myModule: { param1: '12345', param2: '100' } }), ModuleService);
        expect(myService.config).toEqual({ param1: '12345', param2: 100 });
    }
});

test('basic configured', () => {
    expect(new MyService({ debug: true }).isDebug()).toBe(true);
    expect(new MyService({ debug: false }).isDebug()).toBe(false);

    const myConfiguredApp = new MyAppModule({ myModule: { param1: '12345', param2: '100' } });

    {
        const myService = getServiceOnNewServiceContainer(myConfiguredApp, MyService);
        expect(myService.isDebug()).toBe(false);
    }

    {
        const myService = getServiceOnNewServiceContainer(myConfiguredApp.configure({
            debug: false
        }), MyService);
        expect(myService.isDebug()).toBe(false);
    }

    {
        const myService = getServiceOnNewServiceContainer(myConfiguredApp.configure({
            debug: true
        }), MyService);
        expect(myService.isDebug()).toBe(true);
    }

    {
        const myService2 = getServiceOnNewServiceContainer(myConfiguredApp.configure({
            debug: false
        }), MyService2);
        expect(myService2.debug).toBe(false);
    }

    {
        const myService2 = getServiceOnNewServiceContainer(myConfiguredApp.configure({
            debug: true
        }), MyService2);
        expect(myService2.debug).toBe(true);
    }
});

test('config inheritance 1', () => {
    class AppModule extends createModule({
        providers: [
            MyService,
            MyService2,
        ],
        imports: [
            new MyModule({ param1: '12345' }),
        ],
        config: appModuleConfig,
    }) {
    }

    expect(() => new ServiceContainer(new AppModule).process()).toThrow(
        'Configuration for module myModule is invalid. Make sure the module is correctly configured. Error: myModule.param2(required): Required value is undefined'
    );

    expect(new AppModule({ myModule: { param2: 555 } }).getImports()[0].getConfig()).toEqual({ param1: '12345', param2: 555 });

});


test('config inheritance 2', () => {
    const appModule = new AppModule({
        providers: [
            MyService,
            MyService2,
        ],
        imports: [
            new MyModule({ param1: '12345' }),
        ],
        config: appModuleConfig,
    });

    expect(() => new ServiceContainer(appModule).process()).toThrow(
        'Configuration for module myModule is invalid. Make sure the module is correctly configured. Error: myModule.param2(required): Required value is undefined'
    );

    const container = new ServiceContainer(appModule.configure({ myModule: { param2: 555 } }));
    container.process();
    expect(container.appModule.getImports()[0].getConfig()).toEqual({ param1: '12345', param2: 555 });
});


test('configured provider', () => {
    class Transporter {

    }

    class Logger {
        transporter: any[] = [];

        addTransport(transport: any) {
            this.transporter.push(transport);
        }
    }

    const AppModule = createModule({
        providers: [
            Transporter,
            Logger,
        ],
    });

    {
        const fork = new AppModule().clone();
        fork.setupProvider(Logger).addTransport('first').addTransport('second');

        expect(new AppModule().getConfiguredProviderRegistry().get(Logger).length).toBe(0);
        expect(fork.getConfiguredProviderRegistry().get(Logger).length).toBe(2);

        const clone = fork.clone();
        expect(clone.getConfiguredProviderRegistry().get(Logger).length).toBe(2);
    }

    {
        const module = new AppModule();
        const logger = new ServiceContainer(module.setup((module) => {
            module.setupProvider(Logger).addTransport('first').addTransport('second');
        })).getInjectorFor(module).get(Logger);
        expect(logger.transporter).toEqual(['first', 'second']);
    }

    {
        const module = new AppModule();
        const logger = new ServiceContainer(module.setup((module) => {
            module.setupProvider(Logger).transporter = ['first', 'second', 'third'];
        })).getInjectorFor(module).get(Logger);
        expect(logger.transporter).toEqual(['first', 'second', 'third']);
    }

    {
        const module = new AppModule();
        const logger = new ServiceContainer(module.setup((module) => {
            module.setupProvider(Logger).addTransport(new Transporter);
        })).getInjectorFor(module).get(Logger);
        expect(logger.transporter[0] instanceof Transporter).toBe(true);
    }

    {
        const module = new AppModule();
        const logger = new ServiceContainer(module.setup((module) => {
            module.setupProvider(Logger).addTransport(injectorReference(Transporter));
        })).getInjectorFor(module).get(Logger);
        expect(logger.transporter[0] instanceof Transporter).toBe(true);
    }

    {
        const module = new AppModule();
        const logger = new ServiceContainer(module).getInjectorFor(module).get(Logger);
        expect(logger.transporter).toEqual([]);
    }
});

test('same module loaded twice', () => {
    const config = createModuleConfig({ path: t.string.default('/api') });

    @injectable()
    class Service {
        constructor(@inject(config.token('path')) public path: string) {
        }
    }

    class ApiModule extends createModule({
        config,
        providers: [Service]
    }) {
    }

    {
        const app = new AppModule({ imports: [new ApiModule({ path: '/a' })] });
        const serviceContainer = new ServiceContainer(app);
        expect(serviceContainer.getRootInjectorContext().getInjectorForModuleClass(ApiModule).get(Service).path).toBe('/a');
    }

    {
        const app = new AppModule({ imports: [new ApiModule()] });
        const serviceContainer = new ServiceContainer(app);
        expect(serviceContainer.getRootInjectorContext().getInjectorForModuleClass(ApiModule).get(Service).path).toBe('/api');
    }

    {
        const a = new ApiModule({ path: '/a' });
        const b = new ApiModule({ path: '/b' });

        const app = new AppModule({
            imports: [
                a,
                b,
            ]
        });
        const serviceContainer = new ServiceContainer(app);

        expect(serviceContainer.getRootInjectorContext().getModuleForModuleClass(ApiModule).getConfig().path).toBe('/a');
        expect(serviceContainer.getRootInjectorContext().getModuleForModule(a).getConfig().path).toBe('/a');
        expect(serviceContainer.getRootInjectorContext().getModuleForModule(b).getConfig().path).toBe('/b');
        expect(serviceContainer.getInjectorFor(a).get(Service).path).toBe('/a');
        expect(serviceContainer.getInjectorFor(b).get(Service).path).toBe('/b');
    }

});
