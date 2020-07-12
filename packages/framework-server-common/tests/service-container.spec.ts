import 'jest';
import 'jest-extended';
import 'reflect-metadata';
import {DynamicModule, Module, SuperHornetModule} from "../src/module";
import {ControllerContainer, ServiceContainer} from "../src/service-container";
import {injectable} from "../src/injector/injector";
import {Controller} from "@super-hornet/framework-shared";


test('controller', () => {
    class MyService {
        constructor(private text: string = 'hello') {
        }
        getHello() {
            return this.text;
        }
    }

    @Controller('test')
    class MyController {
        constructor(private myService: MyService) {
        }
        foo() {
            return this.myService.getHello();
        }
    }

    {
        @Module({
            providers: [MyService],
            controllers: [MyController],
        })
        class MyModule {
        }

        const serviceContainer = new ServiceContainer();
        serviceContainer.processRootModule(MyModule);
        const controllerContainer = new ControllerContainer(serviceContainer);
        const controller = controllerContainer.resolve<MyController>('test');
        expect(controller).toBeInstanceOf(MyController);
        expect(controller.foo()).toBe('hello');
    }
});

test('controller in module and overwrite service', () => {
    class MyService {
        constructor(private text: string = 'hello') {
        }
        getHello() {
            return this.text;
        }
    }

    @Controller('test')
    class MyController {
        constructor(private myService: MyService) {
        }
        foo() {
            return this.myService.getHello();
        }
    }
    @Module({
        providers: [MyService],
        controllers: [MyController],
        exports: [
            MyService
        ]
    })
    class ControllerModule {
    }

    {
        @Module({
            imports: [ControllerModule],
        })
        class MyModule {
        }

        const serviceContainer = new ServiceContainer();
        serviceContainer.processRootModule(MyModule);
        const controllerContainer = new ControllerContainer(serviceContainer);
        const controller = controllerContainer.resolve<MyController>('test');
        expect(controller).toBeInstanceOf(MyController);
        expect(controller.foo()).toBe('hello');
    }

    {
        @Module({
            providers: [
                {provide: MyService, useValue: new MyService('different')}
            ],
            imports: [ControllerModule],
        })
        class MyModule {
        }

        const serviceContainer = new ServiceContainer();
        serviceContainer.processRootModule(MyModule);
        const controllerContainer = new ControllerContainer(serviceContainer);
        const controller = controllerContainer.resolve<MyController>('test');
        expect(controller).toBeInstanceOf(MyController);
        expect(controller.foo()).toBe('different');
    }
});

test('simple setup with import and overwrite', () => {
    class Connection {
    }

    @injectable()
    class HiddenDatabaseService {
        constructor(public connection: Connection) {
        }
    }

    @Module({
        providers: [Connection, HiddenDatabaseService],
        exports: [Connection]
    })
    class DatabaseModule {
    }

    class MyService {
    }

    @Module({
        providers: [MyService],
        imports: [DatabaseModule]
    })
    class MyModule {
    }

    {
        const serviceContainer = new ServiceContainer();
        serviceContainer.processRootModule(MyModule);
        const injector = serviceContainer.getRootContext().getInjector();

        expect(injector.get(Connection)).toBeInstanceOf(Connection);
        expect(injector.get(MyService)).toBeInstanceOf(MyService);

        expect(() => injector.get(HiddenDatabaseService)).toThrow('Could not resolve injector token HiddenDatabaseService');
        expect(injector.get(MyService)).toBeInstanceOf(MyService);

        const [databaseModuleContext] = serviceContainer.getContextsForModule(DatabaseModule);
        expect(databaseModuleContext.getInjector().get(HiddenDatabaseService)).toBeInstanceOf(HiddenDatabaseService);
        expect(databaseModuleContext.getInjector().get(Connection)).toBe(injector.get(Connection));

        const hiddenService = databaseModuleContext.getInjector().get(HiddenDatabaseService);
        expect(hiddenService.connection).toBe(injector.get(Connection));
        expect(hiddenService.connection).toBe(databaseModuleContext.getInjector().get(Connection));
    }

    {
        class OverwrittenConnection {
        }

        @Module({
            providers: [MyService, {provide: Connection, useClass: OverwrittenConnection}],
            imports: [DatabaseModule]
        })
        class MyModuleOverwritten {
        }

        const serviceContainer = new ServiceContainer();
        serviceContainer.processRootModule(MyModuleOverwritten);
        const injector = serviceContainer.getRootContext().getInjector();

        expect(injector.get(Connection)).toBeInstanceOf(OverwrittenConnection);

        const [databaseModuleContext] = serviceContainer.getContextsForModule(DatabaseModule);
        const hiddenService = databaseModuleContext.getInjector().get(HiddenDatabaseService);
        expect(hiddenService.connection).toBeInstanceOf(OverwrittenConnection);
        expect(databaseModuleContext.getInjector().get(Connection)).toBeInstanceOf(OverwrittenConnection);
    }
});

test('deep', () => {
    class DeepService {
    }

    @Module({
        providers: [DeepService]
    })
    class DeepModule {
    }

    class Connection {
    }

    class HiddenDatabaseService {
    }

    @Module({
        providers: [Connection, HiddenDatabaseService],
        exports: [Connection],
        imports: [DeepModule]
    })
    class DatabaseModule {
    }

    class MyService {
    }

    @Module({
        providers: [MyService],
        imports: [DatabaseModule]
    })
    class MyModule {
    }

    const serviceContainer = new ServiceContainer();
    serviceContainer.processRootModule(MyModule);
    const injector = serviceContainer.getRootContext().getInjector();

    expect(injector.get(Connection)).toBeInstanceOf(Connection);
    expect(injector.get(MyService)).toBeInstanceOf(MyService);

    expect(() => injector.get(HiddenDatabaseService)).toThrow('Could not resolve injector token HiddenDatabaseService');
    expect(() => injector.get(DeepService)).toThrow('Could not resolve injector token DeepService');
    expect(injector.get(MyService)).toBeInstanceOf(MyService);
});


test('scopes', () => {
    class MyService {
    }

    class SessionHandler {
    }

    @Module({
        providers: [MyService, {provide: SessionHandler, scope: 'session'}],
    })
    class MyModule {
    }

    const serviceContainer = new ServiceContainer();
    serviceContainer.processRootModule(MyModule);
    const injector = serviceContainer.getRootContext().createSubInjector('session');

    expect(injector.get(MyService)).toBeInstanceOf(MyService);
    expect(injector.get(SessionHandler)).toBeInstanceOf(SessionHandler);
});


test('for root with exported module', () => {
    class SharedService {
    }

    @Module({
        providers: [SharedService],
        exports: [SharedService]
    })
    class SharedModule {
    }

    @injectable()
    class BaseHandler {
        constructor(private sharedService: SharedService) {
            expect(sharedService).toBeInstanceOf(SharedService);
        }
    }

    @Module({
        providers: [
            BaseHandler
        ],
        imports: [SharedModule],
    })
    class MyBaseModule {
        static forRoot(): DynamicModule {
            return {
                root: true,
                module: MyBaseModule
            }
        }
    }

    @Module({
        imports: [
            MyBaseModule.forRoot()
        ]
    })
    class MyModule {
    }

    const serviceContainer = new ServiceContainer();
    serviceContainer.processRootModule(MyModule);
    const injector = serviceContainer.getRootContext().createSubInjector('session');

    expect(injector.get(BaseHandler)).toBeInstanceOf(BaseHandler);
    expect(injector.get(SharedService)).toBeInstanceOf(SharedService);
});

test('module with config object', () => {
    class ExchangeConfig {
        public startOnBootstrap: boolean = true;
    }

    let bootstrapMainCalledConfig: any;

    @Module({
        providers: [
            ExchangeConfig,
        ],
        exports: [
            ExchangeConfig,
        ]
    })
    class ExchangeModule implements SuperHornetModule {
        constructor(protected config: ExchangeConfig) {
        }

        onBootstrapMain(): Promise<void> | void {
            bootstrapMainCalledConfig = this.config;
            expect(this.config).toBeInstanceOf(ExchangeConfig);
        }
    }

    @Module({
        imports: [ExchangeModule]
    })
    class MyBaseModule {
        static forRoot(): DynamicModule {
            return {
                root: true,
                module: MyBaseModule
            }
        }
    }

    {
        bootstrapMainCalledConfig = undefined;
        @Module({
            imports: [MyBaseModule.forRoot()]
        })
        class MyModule {
        }

        const serviceContainer = new ServiceContainer();
        serviceContainer.processRootModule(MyModule);
        expect(serviceContainer.getRootContext().getInjector().get(ExchangeConfig)).toBeInstanceOf(ExchangeConfig);

        for (const module of serviceContainer.getRegisteredModules()) {
            if (module.onBootstrapMain) module.onBootstrapMain();
        }
        expect(bootstrapMainCalledConfig).toBeInstanceOf(ExchangeConfig);
    }

    {
        bootstrapMainCalledConfig = undefined;
        @Module({
        })
        class MyModule {
        }

        const serviceContainer = new ServiceContainer();
        serviceContainer.processRootModule(MyModule, [], [MyBaseModule.forRoot()]);
        expect(serviceContainer.getRootContext().getInjector().get(ExchangeConfig)).toBeInstanceOf(ExchangeConfig);

        for (const module of serviceContainer.getRegisteredModules()) {
            if (module.onBootstrapMain) module.onBootstrapMain();
        }
        expect(bootstrapMainCalledConfig).toBeInstanceOf(ExchangeConfig);
    }

    {
        bootstrapMainCalledConfig = undefined;
        @Module({
            imports: [ExchangeModule]
        })
        class MyModule {
        }

        const serviceContainer = new ServiceContainer();
        serviceContainer.processRootModule(MyModule);
        expect(serviceContainer.getRootContext().getInjector().get(ExchangeConfig)).toBeInstanceOf(ExchangeConfig);

        for (const module of serviceContainer.getRegisteredModules()) {
            if (module.onBootstrapMain) module.onBootstrapMain();
        }
        expect(bootstrapMainCalledConfig).toBeInstanceOf(ExchangeConfig);
    }

    {
        bootstrapMainCalledConfig = undefined;
        const changedConfig = new ExchangeConfig();
        changedConfig.startOnBootstrap = false;
        @Module({
            providers: [
                {provide: ExchangeConfig, useValue: changedConfig}
            ],
            imports: [ExchangeModule]
        })
        class MyModule {
        }

        const serviceContainer = new ServiceContainer();
        serviceContainer.processRootModule(MyModule);
        expect(serviceContainer.getRootContext().getInjector().get(ExchangeConfig)).toBeInstanceOf(ExchangeConfig);

        for (const module of serviceContainer.getRegisteredModules()) {
            if (module.onBootstrapMain) module.onBootstrapMain();
        }
        expect(bootstrapMainCalledConfig).toBeInstanceOf(ExchangeConfig);
        expect(bootstrapMainCalledConfig).toBe(changedConfig);
    }
});

test('exported module', () => {
    class DatabaseConnection {}

    @Module({
        providers: [DatabaseConnection],
        exports: [
            DatabaseConnection
        ]
    })
    class DatabaseModule {}

    class FSService {}

    @Module({
        providers: [FSService],
        imports: [DatabaseModule],
        exports: [
            DatabaseModule
        ]
    })
    class FSModule {}

    {
        @Module({
            imports: [FSModule]
        })
        class MyModule {
        }

        const serviceContainer = new ServiceContainer();
        serviceContainer.processRootModule(MyModule);
        const rootInjector = serviceContainer.getRootContext().getInjector();

        expect(rootInjector.get(DatabaseConnection)).toBeInstanceOf(DatabaseConnection);

        const databaseModuleInjector = serviceContainer.getContextsForModule(DatabaseModule)[0].getInjector();
        expect(databaseModuleInjector.get(DatabaseConnection)).toBeInstanceOf(DatabaseConnection);
        expect(databaseModuleInjector.get(DatabaseConnection)).toBe(rootInjector.get(DatabaseConnection));
    }
});
