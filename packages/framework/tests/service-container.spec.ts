import 'jest';
import 'jest-extended';
import 'reflect-metadata';
import {DynamicModule, deepkit, SuperHornetModule} from '../src/decorator';
import {ControllerContainer, ServiceContainer} from '../src/service-container';
import {injectable, Injector} from '../src/injector/injector';
import {rpc} from '@deepkit/framework-shared';


test('controller', () => {
    class MyService {
        constructor(private text: string = 'hello') {
        }

        getHello() {
            return this.text;
        }
    }

    @rpc.controller('test')
    class MyController {
        constructor(private myService: MyService) {
        }

        foo() {
            return this.myService.getHello();
        }
    }

    {
        @deepkit.module({
            providers: [MyService],
            controllers: [MyController],
        })
        class MyModule {
        }

        const serviceContainer = new ServiceContainer();
        serviceContainer.processRootModule(MyModule);
        const controllerContainer = new ControllerContainer(serviceContainer.rpcControllers);
        const controller = controllerContainer.createController(MyController);
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

    @rpc.controller('test')
    class MyController {
        constructor(private myService: MyService) {
        }

        foo() {
            return this.myService.getHello();
        }
    }

    @deepkit.module({
        providers: [MyService],
        controllers: [MyController],
        exports: [
            MyService
        ]
    })
    class ControllerModule {
    }

    {
        @deepkit.module({
            imports: [ControllerModule],
        })
        class MyModule {
        }

        const serviceContainer = new ServiceContainer();
        serviceContainer.processRootModule(MyModule);
        const controllerContainer = new ControllerContainer(serviceContainer.rpcControllers);
        const controller = controllerContainer.createController(MyController);
        expect(controller).toBeInstanceOf(MyController);
        expect(controller.foo()).toBe('hello');
    }

    {
        @deepkit.module({
            providers: [
                {provide: MyService, useValue: new MyService('different')}
            ],
            imports: [ControllerModule],
        })
        class MyModule {
        }

        const serviceContainer = new ServiceContainer();
        serviceContainer.processRootModule(MyModule);
        const controllerContainer = new ControllerContainer(serviceContainer.rpcControllers);
        const controller = controllerContainer.createController(MyController);
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

    @deepkit.module({
        providers: [Connection, HiddenDatabaseService],
        exports: [Connection]
    })
    class DatabaseModule {
    }

    class MyService {
    }

    @deepkit.module({
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

        @deepkit.module({
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

    @deepkit.module({
        providers: [DeepService]
    })
    class DeepModule {
    }

    class Connection {
    }

    class HiddenDatabaseService {
    }

    @deepkit.module({
        providers: [Connection, HiddenDatabaseService],
        exports: [Connection],
        imports: [DeepModule]
    })
    class DatabaseModule {
    }

    class MyService {
    }

    @deepkit.module({
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

    @deepkit.module({
        providers: [MyService, {provide: SessionHandler, scope: 'session'}],
    })
    class MyModule {
    }

    const serviceContainer = new ServiceContainer();
    serviceContainer.processRootModule(MyModule);
    const sessionInjector = serviceContainer.getRootContext().getSessionInjector();

    expect(() => sessionInjector.get(MyService)).toThrow('Could not resolve');
    expect(sessionInjector.get(SessionHandler)).toBeInstanceOf(SessionHandler);

    const mainInjector = serviceContainer.getRootContext().getInjector();

    expect(() => mainInjector.get(SessionHandler)).toThrow('Could not resolve');
    expect(mainInjector.get(MyService)).toBeInstanceOf(MyService);
});


test('for root with exported module', () => {
    class SharedService {
    }

    @deepkit.module({
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

    @deepkit.module({
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
            };
        }
    }

    @deepkit.module({
        imports: [
            MyBaseModule.forRoot()
        ]
    })
    class MyModule {
    }

    const serviceContainer = new ServiceContainer();
    serviceContainer.processRootModule(MyModule);
    const injector = new Injector([], [serviceContainer.getRootContext().getInjector(), serviceContainer.getRootContext().getSessionInjector()]);

    expect(injector.get(BaseHandler)).toBeInstanceOf(BaseHandler);
    expect(injector.get(SharedService)).toBeInstanceOf(SharedService);
});

test('module with config object', () => {
    class ExchangeConfig {
        public startOnBootstrap: boolean = true;
    }

    let bootstrapMainCalledConfig: any;

    @deepkit.module({
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

        onBootstrapServer(): Promise<void> | void {
            bootstrapMainCalledConfig = this.config;
            expect(this.config).toBeInstanceOf(ExchangeConfig);
        }
    }

    @deepkit.module({
        imports: [ExchangeModule]
    })
    class MyBaseModule {
        static forRoot(): DynamicModule {
            return {
                root: true,
                module: MyBaseModule
            };
        }
    }

    {
        bootstrapMainCalledConfig = undefined;

        @deepkit.module({
            imports: [MyBaseModule.forRoot()]
        })
        class MyModule {
        }

        const serviceContainer = new ServiceContainer();
        serviceContainer.processRootModule(MyModule);
        expect(serviceContainer.getRootContext().getInjector().get(ExchangeConfig)).toBeInstanceOf(ExchangeConfig);

        for (const module of serviceContainer.getRegisteredModules()) {
            if (module.onBootstrapServer) module.onBootstrapServer();
        }
        expect(bootstrapMainCalledConfig).toBeInstanceOf(ExchangeConfig);
    }

    {
        bootstrapMainCalledConfig = undefined;

        @deepkit.module({})
        class MyModule {
        }

        const serviceContainer = new ServiceContainer();
        serviceContainer.processRootModule(MyModule, [], [MyBaseModule.forRoot()]);
        expect(serviceContainer.getRootContext().getInjector().get(ExchangeConfig)).toBeInstanceOf(ExchangeConfig);

        for (const module of serviceContainer.getRegisteredModules()) {
            if (module.onBootstrapServer) module.onBootstrapServer();
        }
        expect(bootstrapMainCalledConfig).toBeInstanceOf(ExchangeConfig);
    }

    {
        bootstrapMainCalledConfig = undefined;

        @deepkit.module({
            imports: [ExchangeModule]
        })
        class MyModule {
        }

        const serviceContainer = new ServiceContainer();
        serviceContainer.processRootModule(MyModule);
        expect(serviceContainer.getRootContext().getInjector().get(ExchangeConfig)).toBeInstanceOf(ExchangeConfig);

        for (const module of serviceContainer.getRegisteredModules()) {
            if (module.onBootstrapServer) module.onBootstrapServer();
        }
        expect(bootstrapMainCalledConfig).toBeInstanceOf(ExchangeConfig);
    }

    {
        bootstrapMainCalledConfig = undefined;
        const changedConfig = new ExchangeConfig();
        changedConfig.startOnBootstrap = false;

        @deepkit.module({
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
            if (module.onBootstrapServer) module.onBootstrapServer();
        }
        expect(bootstrapMainCalledConfig).toBeInstanceOf(ExchangeConfig);
        expect(bootstrapMainCalledConfig).toBe(changedConfig);
    }
});

test('exported module', () => {
    class DatabaseConnection {
    }

    @deepkit.module({
        providers: [DatabaseConnection],
        exports: [
            DatabaseConnection
        ]
    })
    class DatabaseModule {
    }

    class FSService {
    }

    @deepkit.module({
        providers: [FSService],
        imports: [DatabaseModule],
        exports: [
            DatabaseModule
        ]
    })
    class FSModule {
    }

    {
        @deepkit.module({
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
