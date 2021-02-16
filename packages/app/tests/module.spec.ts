import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { t } from '@deepkit/type';
import { ConfigSlice, inject, injectable, injectorReference } from '@deepkit/injector';
import { ServiceContainer } from '../src/service-container';
import { ClassType } from '@deepkit/core';
import { AppModule, AppModuleConfig } from '../src/module';

const myModuleConfig = new AppModuleConfig({
    param1: t.string.minLength(5),
    param2: t.number.minimum(100)
});

class MyModuleConfigFull extends myModuleConfig.all() { }

@injectable()
class ModuleService {
    constructor(public readonly config: MyModuleConfigFull) {
    }
}

const MyModule = new AppModule({
    config: myModuleConfig,
    providers: [
        ModuleService
    ],
    exports: [ModuleService]
}, 'myModule');

const appModuleConfig = new AppModuleConfig({
    database: t.string.default('mongodb://localhost/my-app'),
    debug: t.boolean.default(false),
});

class MyServiceConfig extends appModuleConfig.slice(['debug']) { }
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

const myAppModule = new AppModule({
    providers: [
        MyService,
        MyService2,
    ],
    imports: [
        MyModule,
    ],
    config: appModuleConfig,
});

function getMyServiceFor<T>(module: AppModule<any>, service: ClassType<T>): T {
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
    //     expect(() => getMyServiceFor(AppModule, ModuleService)).toThrow(
    //         'Configuration for module myModule is invalid. Make sure the module is correctly configured. Error: myModule.param1(required): Required value is undefined, myModule.param2(required): Required value is undefined'
    //     );
    // }

    {
        expect(() => getMyServiceFor(myAppModule.configure({ myModule: { param1: '23' } }), ModuleService)).toThrow(
            'Configuration for module myModule is invalid. Make sure the module is correctly configured. Error: myModule.param1(minLength): Min length is 5, myModule.param2(required): Required value is undefined'
        );
    }

    {
        expect(() => getMyServiceFor(myAppModule.configure({ myModule: { param1: '12345' } }), ModuleService)).toThrow(
            'Configuration for module myModule is invalid. Make sure the module is correctly configured. Error: myModule.param2(required): Required value is undefined'
        );
    }

    {
        expect(() => getMyServiceFor(myAppModule.configure({ myModule: { param1: '12345', param2: 55 } }), ModuleService)).toThrow(
            'Configuration for module myModule is invalid. Make sure the module is correctly configured. Error: myModule.param2(minimum): Number needs to be greater than or equal to 100'
        );
    }

    {
        expect(() => getMyServiceFor(myAppModule.configure({ myModule: { param1: '12345', param2: '55' } }), ModuleService)).toThrow(
            'Configuration for module myModule is invalid. Make sure the module is correctly configured. Error: myModule.param2(minimum): Number needs to be greater than or equal to 100'
        );
    }

    {
        const myService = getMyServiceFor(myAppModule.configure({ myModule: { param1: '12345', param2: 100 } }), ModuleService);
        expect(myService.config).toEqual({ param1: '12345', param2: 100 });
    }

    {
        //@deepkit/type does automatically soft-type casting
        const myService = getMyServiceFor(myAppModule.configure({ myModule: { param1: '12345', param2: '100' } }), ModuleService);
        expect(myService.config).toEqual({ param1: '12345', param2: 100 });
    }
});

test('basic configured', () => {
    expect(new MyService({ debug: true }).isDebug()).toBe(true);
    expect(new MyService({ debug: false }).isDebug()).toBe(false);

    const myConfiguredApp = myAppModule.configure({ myModule: { param1: '12345', param2: '100' } });

    {
        const myService = getMyServiceFor(myConfiguredApp, MyService);
        expect(myService.isDebug()).toBe(false);
    }

    {
        const myService = getMyServiceFor(myConfiguredApp.configure({
            debug: false
        }), MyService);
        expect(myService.isDebug()).toBe(false);
    }

    {
        const myService = getMyServiceFor(myConfiguredApp.configure({
            debug: true
        }), MyService);
        expect(myService.isDebug()).toBe(true);
    }

    {
        const myService2 = getMyServiceFor(myConfiguredApp.configure({
            debug: false
        }), MyService2);
        expect(myService2.debug).toBe(false);
    }

    {
        const myService2 = getMyServiceFor(myConfiguredApp.configure({
            debug: true
        }), MyService2);
        expect(myService2.debug).toBe(true);
    }
});

test('config inheritance', () => {
    const appModule = new AppModule({
        providers: [
            MyService,
            MyService2,
        ],
        imports: [
            MyModule.configure({ param1: '12345' }),
        ],
        config: appModuleConfig,
    });

    expect(() => appModule.getImports()[0].getConfig()).toThrow(
        'Configuration for module myModule is invalid. Make sure the module is correctly configured. Error: myModule.param2(required): Required value is undefined'
    );

    expect(appModule.configure({ myModule: { param2: 555 } }).getImports()[0].getConfig()).toEqual({ param1: '12345', param2: 555 });

});


test('config inheritance', () => {
    const appModule = new AppModule({
        providers: [
            MyService,
            MyService2,
        ],
        imports: [
            MyModule.configure({ param1: '12345' }),
        ],
        config: appModuleConfig,
    });

    expect(() => appModule.getImports()[0].getConfig()).toThrow(
        'Configuration for module myModule is invalid. Make sure the module is correctly configured. Error: myModule.param2(required): Required value is undefined'
    );

    expect(appModule.configure({ myModule: { param2: 555 } }).getImports()[0].getConfig()).toEqual({ param1: '12345', param2: 555 });

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

    const appModule = new AppModule({
        providers: [
            Transporter,
            Logger,
        ],
    });

    {
        const fork = appModule.clone();
        fork.setupProvider(Logger).addTransport('first').addTransport('second');

        expect(appModule.getConfiguredProviderRegistry().get(Logger).length).toBe(0);
        expect(fork.getConfiguredProviderRegistry().get(Logger).length).toBe(2);

        const clone = fork.clone();
        expect(clone.getConfiguredProviderRegistry().get(Logger).length).toBe(2);
    }

    {
        const logger = new ServiceContainer(appModule.setup((module) => {
            module.setupProvider(Logger).addTransport('first').addTransport('second');
        })).getInjectorFor(appModule).get(Logger);
        expect(logger.transporter).toEqual(['first', 'second']);
    }

    {
        const logger = new ServiceContainer(appModule.setup((module) => {
            module.setupProvider(Logger).transporter = ['first', 'second', 'third'];
        })).getInjectorFor(appModule).get(Logger);
        expect(logger.transporter).toEqual(['first', 'second', 'third']);
    }

    {
        const logger = new ServiceContainer(appModule.setup((module) => {
            module.setupProvider(Logger).addTransport(new Transporter);
        })).getInjectorFor(appModule).get(Logger);
        expect(logger.transporter[0] instanceof Transporter).toBe(true);
    }

    {
        const logger = new ServiceContainer(appModule.setup((module) => {
            module.setupProvider(Logger).addTransport(injectorReference(Transporter));
        })).getInjectorFor(appModule).get(Logger);
        expect(logger.transporter[0] instanceof Transporter).toBe(true);
    }

    {
        const logger = new ServiceContainer(appModule).getInjectorFor(appModule).get(Logger);
        expect(logger.transporter).toEqual([]);
    }
});
