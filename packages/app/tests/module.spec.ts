import { expect, test } from '@jest/globals';
import { Minimum, MinLength } from '@deepkit/type';
import { provide } from '@deepkit/injector';
import { ServiceContainer } from '../src/service-container.js';
import { ClassType } from '@deepkit/core';
import { AppModule, createModuleClass } from '../src/module.js';

class MyModuleConfig {
    param1!: string & MinLength<5>;
    param2!: number & Minimum<100>;
}

class ModuleService {
    constructor(public readonly config: MyModuleConfig) {
    }
}

class MyModule extends createModuleClass({
    config: MyModuleConfig,
    providers: [
        ModuleService
    ],
    exports: [ModuleService]
}) {
}

class AppModuleConfig {
    database: string = 'mongodb://localhost/my-app';
    debug: boolean = false;
    myModule?: Partial<{
        param1: string;
        param2: number;
    }>;
}

type MyServiceConfig = Pick<AppModuleConfig, 'debug'>;

class MyService {
    constructor(private config: MyServiceConfig) {
    }

    isDebug(): boolean {
        return this.config.debug;
    }
}

class MyService2 {
    constructor(public debug: AppModuleConfig['debug']) {
    }
}

class MyAppModule extends createModuleClass({
    providers: [
        MyService,
        MyService2,
    ],
    config: AppModuleConfig,
}) {
    imports = [new MyModule()];

    process() {
        if (this.config.myModule) this.getImportedModuleByClass(MyModule).configure(this.config.myModule);
    }
}

function getServiceOnNewServiceContainer<T>(module: AppModule<any>, service: ClassType<T>): T {
    const serviceContainer = new ServiceContainer(module);
    return serviceContainer.getInjectorContext().get(service) as T;
}

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
            return this;
        }
    }

    const AppModule = createModuleClass({
        providers: [
            Transporter,
            Logger,
        ],
    });

    {
        const module = new AppModule();
        const logger = new ServiceContainer(module.setup((module) => {
            module.configureProvider<Logger>(v => v.addTransport('first').addTransport('second'));
        })).getInjector(module).get(Logger);
        expect(logger.transporter).toEqual(['first', 'second']);
    }

    {
        const module = new AppModule();
        const logger = new ServiceContainer(module.setup((module) => {
            module.configureProvider<Logger>(v => v.transporter = ['first', 'second', 'third']);
        })).getInjector(module).get(Logger);
        expect(logger.transporter).toEqual(['first', 'second', 'third']);
    }

    {
        const module = new AppModule();
        const logger = new ServiceContainer(module.setup((module) => {
            module.configureProvider<Logger>(v => v.addTransport(new Transporter));
        })).getInjector(module).get(Logger);
        expect(logger.transporter[0] instanceof Transporter).toBe(true);
    }

    {
        const module = new AppModule();
        const logger = new ServiceContainer(module.setup((module) => {
            module.configureProvider<Logger>((v, t: Transporter) => v.addTransport(t));
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
    class Config {
        path: string = '/api';
    }

    class Service {
        constructor(public path: Config['path']) {
        }
    }

    class ApiModule extends createModuleClass({
        config: Config,
        providers: [Service]
    }) {
    }

    {
        const app = new AppModule({}, { imports: [new ApiModule({ path: '/a' })] });
        const serviceContainer = new ServiceContainer(app);
        expect(serviceContainer.getInjector(ApiModule).get(Service).path).toBe('/a');
    }

    {
        const app = new AppModule({}, { imports: [new ApiModule()] });
        const serviceContainer = new ServiceContainer(app);
        expect(serviceContainer.getInjector(ApiModule).get(Service).path).toBe('/api');
    }

    {
        const a = new ApiModule({ path: '/a' });
        const b = new ApiModule({ path: '/b' });

        const app = new AppModule({}, {
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

test('interface provider can be exported', () => {
   interface Test {}

   const TEST = {};

   const Test = provide<Test>({ useValue: TEST });

   const test = new AppModule({}, { providers: [Test], exports: [Test] });

   const app = new AppModule({}, { imports: [test] });

    const serviceContainer = new ServiceContainer(app);

   expect(serviceContainer.getInjector(app).get<Test>()).toBe(TEST);
});

test('non-exported providers can not be overwritten', () => {
    class SubClass {
    }

    class Overwritten {
    }

    const sub = new AppModule({}, { providers: [SubClass] });
    const app = new AppModule({}, {
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

    const sub = new AppModule({}, { providers: [SubClass], exports: [SubClass] });
    const app = new AppModule({}, {
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

    class ApiModule extends createModuleClass({}) {
        label: string = '';

        set(label: string): this {
            this.label = label;
            return this;
        }

        process() {
            this.addProvider({ provide: Service, useValue: new Service(this.label) });
        }
    }

    const serviceContainer = new ServiceContainer(new AppModule({}, { imports: [new ApiModule().set('changed1')] }));
    expect(serviceContainer.getInjector(ApiModule).get(Service).label).toBe('changed1');
});

test('change config of a imported module dynamically', () => {
    class Logger {
    }

    class Query {
        constructor(public logger?: Logger) {
        }
    }

    class DatabaseConfig {
        logging: boolean = false;
    }

    class DatabaseModule extends createModuleClass({
        config: DatabaseConfig,
        providers: [Query]
    }) {
        process() {
            if (this.config.logging) {
                this.addProvider(Logger);
            }
        }
    }

    class ApiConfig {
        debug: boolean = false;
    }

    class ApiModule extends createModuleClass({
        config: ApiConfig
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

    const module = new AppModule({}, {
        providers: [{ provide: Service, scope: 'http' }]
    });

    const serviceContainer = new ServiceContainer(new AppModule({}, { imports: [module] }));

    {
        const scope = serviceContainer.getInjectorContext().createChildScope('http');
        expect(scope.get(Service, module)).toBeInstanceOf(Service);
        expect(created).toBe(1);
    }

    {
        const injector = serviceContainer.getInjector(module);
        expect(() => injector.get(Service)).toThrow(`Service 'Service' is known but is not available in scope global`);
    }

    {
        const scope = serviceContainer.getInjectorContext().createChildScope('http');
        expect(scope.get(Service, module)).toBeInstanceOf(Service);
        expect(created).toBe(2);
    }
});

test('functional modules factory', () => {
    const myModule = (title: string) => {
        return (module: AppModule) => {
            module.addProvider({ provide: 'title', useValue: title });
            module.forRoot();
        };
    };

    const module = new AppModule({}, {
        imports: [myModule('Peter')],
    });
    const serviceContainer = new ServiceContainer(module);

    expect(serviceContainer.getInjectorContext().get('title')).toBe('Peter');
});

test('functional modules', () => {
    const myModule = (module: AppModule) => {
        module.addProvider({ provide: 'title', useValue: 'Peter' });
        module.forRoot();
    };

    const module = new AppModule({}, {
        imports: [myModule],
    });
    const serviceContainer = new ServiceContainer(module);

    expect(serviceContainer.getInjectorContext().get('title')).toBe('Peter');
});
