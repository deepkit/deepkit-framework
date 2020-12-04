import 'jest';
import 'reflect-metadata';
import {t} from '@deepkit/type';
import {ConfigSlice, createConfig, inject, injectable} from '../src/injector/injector';
import {createModule, Module} from '../src/module';
import {ServiceContainer} from '../src/service-container';
import {ClassType} from '@deepkit/core';


const myModuleConfig = createConfig({
    param1: t.string.minLength(5),
    param2: t.number.minimum(100)
});

class MyModuleConfigFull extends myModuleConfig.all() {}

@injectable()
class ModuleService {
    constructor(public readonly config: MyModuleConfigFull) {
    }
}

const MyModule = createModule({
    name: 'myModule',
    config: myModuleConfig,
    providers: [
        ModuleService
    ],
    exports: [ModuleService]
});


const AppModuleConfig = createConfig({
    database: t.string.default('mongodb://localhost/my-app'),
    debug: t.boolean.default(false),
});

class MyServiceConfig extends AppModuleConfig.slice(['debug']) {}
const debugConfigToken = AppModuleConfig.token('debug');

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

const AppModule = createModule({
    providers: [
        MyService,
        MyService2,
    ],
    imports: [
        MyModule,
    ],
    config: AppModuleConfig,
});

function getMyServiceFor<T>(module: Module<any>, service: ClassType<T>): T {
    const serviceContainer = new ServiceContainer(module);
    return serviceContainer.rootScopedContext.get(service);
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
        expect(() => getMyServiceFor(AppModule.configure({myModule: {param1: '23'}}), ModuleService)).toThrow(
            'Configuration for module myModule is invalid. Make sure the module is correctly configured. Error: myModule.param1(minLength): Min length is 5, myModule.param2(required): Required value is undefined'
        );
    }

    {
        expect(() => getMyServiceFor(AppModule.configure({myModule: {param1: '12345'}}), ModuleService)).toThrow(
            'Configuration for module myModule is invalid. Make sure the module is correctly configured. Error: myModule.param2(required): Required value is undefined'
        );
    }

    {
        expect(() => getMyServiceFor(AppModule.configure({myModule: {param1: '12345', param2: 55}}), ModuleService)).toThrow(
            'Configuration for module myModule is invalid. Make sure the module is correctly configured. Error: myModule.param2(minimum): Number needs to be greater than or equal to 100'
        );
    }

    {
        expect(() => getMyServiceFor(AppModule.configure({myModule: {param1: '12345', param2: '55'}}), ModuleService)).toThrow(
            'Configuration for module myModule is invalid. Make sure the module is correctly configured. Error: myModule.param2(minimum): Number needs to be greater than or equal to 100'
        );
    }

    {
        const myService = getMyServiceFor(AppModule.configure({myModule: {param1: '12345', param2: 100}}), ModuleService);
        expect(myService.config).toEqual({param1: '12345', param2: 100});
    }

    {
        //@deepkit/type does automatically soft-type casting
        const myService = getMyServiceFor(AppModule.configure({myModule: {param1: '12345', param2: '100'}}), ModuleService);
        expect(myService.config).toEqual({param1: '12345', param2: 100});
    }
});

test('basic configured', () => {
    expect(new MyService({debug: true}).isDebug()).toBe(true);
    expect(new MyService({debug: false}).isDebug()).toBe(false);

    const myConfiguredApp = AppModule.configure({myModule: {param1: '12345', param2: '100'}});

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
    const AppModule = createModule({
        providers: [
            MyService,
            MyService2,
        ],
        imports: [
            MyModule.configure({param1: '12345'}),
        ],
        config: AppModuleConfig,
    });

    expect(() => AppModule.getImports()[0].getConfig()).toThrow(
        'Configuration for module myModule is invalid. Make sure the module is correctly configured. Error: myModule.param2(required): Required value is undefined'
    );

    expect(AppModule.configure({myModule: {param2: 555}}).getImports()[0].getConfig()).toEqual({param1: '12345', param2: 555});

});


test('config inheritance', () => {
    const AppModule = createModule({
        providers: [
            MyService,
            MyService2,
        ],
        imports: [
            MyModule.configure({param1: '12345'}),
        ],
        config: AppModuleConfig,
    });

    expect(() => AppModule.getImports()[0].getConfig()).toThrow(
        'Configuration for module myModule is invalid. Make sure the module is correctly configured. Error: myModule.param2(required): Required value is undefined'
    );

    expect(AppModule.configure({myModule: {param2: 555}}).getImports()[0].getConfig()).toEqual({param1: '12345', param2: 555});

});
