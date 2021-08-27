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

@injectable
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
    myModule: t.partial({
        param1: t.string,
        param2: t.number
    }).optional
});

class MyServiceConfig extends appModuleConfig.slice('debug') {
}

const debugConfigToken = appModuleConfig.token('debug');

expect(Object.getPrototypeOf(Object.getPrototypeOf(MyServiceConfig)) === ConfigSlice).toBe(true);

@injectable
class MyService {
    constructor(private config: MyServiceConfig) {
    }

    isDebug(): boolean {
        return this.config.debug;
    }
}

@injectable
class MyService2 {
    constructor(@inject(debugConfigToken) public debug: boolean) {
    }
}

class MyAppModule extends createModule({
    providers: [
        MyService,
        MyService2,
    ],
    config: appModuleConfig,
}) {
    imports = [new MyModule()];

    process() {
        if (this.config.myModule) this.getImportedModuleByClass(MyModule).configure(this.config.myModule);
    }
}

function getServiceOnNewServiceContainer<T>(module: AppModule<any>, service: ClassType<T>): T {
    const serviceContainer = new ServiceContainer(module);
    return serviceContainer.getInjectorContext().get(service);
}

test('import', () => {
    {
        expect(() => getServiceOnNewServiceContainer(new MyAppModule, ModuleService)).toThrow(
            'Configuration for module myModule is invalid. Make sure the module is correctly configured. Error: myModule.param1(required): Required value is undefined, myModule.param2(required): Required value is undefined'
        );
    }

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
        const myService = getServiceOnNewServiceContainer(new MyAppModule({ myModule: { param1: '12345', param2: 100 } }), ModuleService);
        expect(myService.config).toEqual({ param1: '12345', param2: 100 });
    }
});

test('basic configured', () => {
    expect(new MyService({ debug: true }).isDebug()).toBe(true);
    expect(new MyService({ debug: false }).isDebug()).toBe(false);

    function createConfiguredApp() {
        return new MyAppModule({ myModule: { param1: '12345', param2: 100 } });
    }

    {
        const myService = getServiceOnNewServiceContainer(createConfiguredApp(), MyService);
        expect(myService.isDebug()).toBe(false);
    }

    {
        const myService = getServiceOnNewServiceContainer(createConfiguredApp().configure({
            debug: false
        }), MyService);
        expect(myService.isDebug()).toBe(false);
    }

    {
        const myService = getServiceOnNewServiceContainer(createConfiguredApp().configure({
            debug: true
        }), MyService);
        expect(myService.isDebug()).toBe(true);
    }

    {
        const myService2 = getServiceOnNewServiceContainer(createConfiguredApp().configure({
            debug: false
        }), MyService2);
        expect(myService2.debug).toBe(false);
    }

    {
        const myService2 = getServiceOnNewServiceContainer(createConfiguredApp().configure({
            debug: true
        }), MyService2);
        expect(myService2.debug).toBe(true);
    }
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
        const module = new AppModule();
        const logger = new ServiceContainer(module.setup((module) => {
            module.setupProvider(Logger).addTransport('first').addTransport('second');
        })).getInjector(module).get(Logger);
        expect(logger.transporter).toEqual(['first', 'second']);
    }

    {
        const module = new AppModule();
        const logger = new ServiceContainer(module.setup((module) => {
            module.setupProvider(Logger).transporter = ['first', 'second', 'third'];
        })).getInjector(module).get(Logger);
        expect(logger.transporter).toEqual(['first', 'second', 'third']);
    }

    {
        const module = new AppModule();
        const logger = new ServiceContainer(module.setup((module) => {
            module.setupProvider(Logger).addTransport(new Transporter);
        })).getInjector(module).get(Logger);
        expect(logger.transporter[0] instanceof Transporter).toBe(true);
    }

    {
        const module = new AppModule();
        const logger = new ServiceContainer(module.setup((module) => {
            module.setupProvider(Logger).addTransport(injectorReference(Transporter));
        })).getInjector(module).get(Logger);
        expect(logger.transporter[0] instanceof Transporter).toBe(true);
    }

    {
        const module = new AppModule();
        const logger = new ServiceContainer(module).getInjector(module).get(Logger);
        expect(logger.transporter).toEqual([]);
    }
});

test('same module loaded twice', () => {
    const config = createModuleConfig({ path: t.string.default('/api') });

    @injectable
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
        expect(serviceContainer.getInjector(ApiModule).get(Service).path).toBe('/a');
    }

    {
        const app = new AppModule({ imports: [new ApiModule()] });
        const serviceContainer = new ServiceContainer(app);
        expect(serviceContainer.getInjector(ApiModule).get(Service).path).toBe('/api');
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

        expect((serviceContainer.getModule(ApiModule).getConfig() as any).path).toBe('/a');
        expect(a.getConfig().path).toBe('/a');
        expect(b.getConfig().path).toBe('/b');
        expect(serviceContainer.getInjector(a).get(Service).path).toBe('/a');
        expect(serviceContainer.getInjector(b).get(Service).path).toBe('/b');
    }
});

test('non-exported providers can not be overwritten', () => {
    class SubClass {
    }

    class Overwritten {
    }

    const sub = new AppModule({ providers: [SubClass] });
    const app = new AppModule({
        providers: [Overwritten, { provide: SubClass, useClass: Overwritten }],
        imports: [
            sub
        ]
    });

    const serviceContainer = new ServiceContainer(app);

    expect(serviceContainer.getInjector(sub).get(SubClass)).toBeInstanceOf(SubClass);
    expect(serviceContainer.getInjector(app).get(SubClass)).toBeInstanceOf(Overwritten);
});

test('exported providers can not be overwritten', () => {
    class SubClass {
    }

    class Overwritten {
    }

    const sub = new AppModule({ providers: [SubClass], exports: [SubClass] });
    const app = new AppModule({
        providers: [Overwritten, { provide: SubClass, useClass: Overwritten }],
        imports: [
            sub
        ]
    });

    const serviceContainer = new ServiceContainer(app);

    expect(serviceContainer.getInjector(sub).get(SubClass)).toBeInstanceOf(Overwritten);
    expect(serviceContainer.getInjector(app).get(SubClass)).toBeInstanceOf(Overwritten);
});

test('instance is used as is', () => {
    class Service {
        constructor(public label: string) {
        }
    }

    class ApiModule extends createModule({}) {
        label: string = '';

        set(label: string): this {
            this.label = label;
            return this;
        }

        process() {
            this.addProvider({ provide: Service, useValue: new Service(this.label) });
        }
    }

    const serviceContainer = new ServiceContainer(new AppModule({ imports: [new ApiModule().set('changed1')] }));
    expect(serviceContainer.getInjector(ApiModule).get(Service).label).toBe('changed1');
});

test('change config of a imported module dynamically', () => {
    class Logger {
    }

    class Query {
        constructor(@t.optional public logger?: Logger) {
        }
    }

    class DatabaseModule extends createModule({
        config: createModuleConfig({
            logging: t.boolean.default(false)
        }),
        providers: [Query]
    }) {
        process() {
            if (this.config.logging) {
                this.addProvider(Logger);
            }
        }
    }

    class ApiModule extends createModule({
        config: createModuleConfig({
            debug: t.boolean.default(false)
        })
    }) {
        imports = [new DatabaseModule({ logging: false })];

        process() {
            if (this.config.debug) {
                const [database] = this.getImportedModulesByClass(DatabaseModule);
                database.configure({ logging: true });
            }
        }
    }

    {
        const api = new ApiModule();
        expect(api.getImportedModuleByClass(DatabaseModule)).toBeInstanceOf(DatabaseModule);
        expect(api.getImportedModulesByClass(DatabaseModule)[0]).toBeInstanceOf(DatabaseModule);
    }

    {
        const serviceContainer = new ServiceContainer(new ApiModule());
        expect(serviceContainer.getInjector(DatabaseModule).get(Query).logger).toBe(undefined);
    }


    {
        const serviceContainer = new ServiceContainer(new ApiModule({ debug: true }));
        expect(serviceContainer.getInjector(DatabaseModule).get(Query).logger).toBeInstanceOf(Logger);
    }


    {
        const serviceContainer = new ServiceContainer(new ApiModule());
        expect(serviceContainer.getInjector(DatabaseModule).get(Query).logger).toBe(undefined);
    }
});

test('scoped injector', () => {

    let created = 0;

    class Service {
        constructor() {
            created++;
        }
    }

    const module = new AppModule({
        providers: [{ provide: Service, scope: 'http' }]
    });

    const serviceContainer = new ServiceContainer(new AppModule({ imports: [module] }));

    {
        const scope = serviceContainer.getInjectorContext().createChildScope('http');
        expect(scope.get(Service, module)).toBeInstanceOf(Service);
        expect(created).toBe(1);
    }

    {
        const injector = serviceContainer.getInjector(module);
        expect(() => injector.get(Service)).toThrow('not found');
    }

    {
        const scope = serviceContainer.getInjectorContext().createChildScope('http');
        expect(scope.get(Service, module)).toBeInstanceOf(Service);
        expect(created).toBe(2);
    }

});
