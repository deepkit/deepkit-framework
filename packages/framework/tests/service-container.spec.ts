import 'jest';
import 'jest-extended';
import 'reflect-metadata';
import {RpcControllerContainer, ServiceContainer} from '../src/service-container';
import {injectable, Injector} from '../src/injector/injector';
import {rpc} from '@deepkit/framework-shared';
import {createModule} from '../src/module';

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
        const MyModule = createModule({
            providers: [MyService],
            controllers: [MyController],
        });

        const serviceContainer = new ServiceContainer();
        serviceContainer.processRootModule(MyModule);
        const controllerContainer = new RpcControllerContainer(serviceContainer.rpcControllers);
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

    const ControllerModule = createModule({
        providers: [MyService],
        controllers: [MyController],
        exports: [
            MyService
        ]
    });

    {
        const MyModule = createModule({
            imports: [ControllerModule],
        });

        const serviceContainer = new ServiceContainer();
        serviceContainer.processRootModule(MyModule);
        const controllerContainer = new RpcControllerContainer(serviceContainer.rpcControllers);
        const controller = controllerContainer.createController(MyController);
        expect(controller).toBeInstanceOf(MyController);
        expect(controller.foo()).toBe('hello');
    }

    {
        const MyModule = createModule({
            providers: [
                {provide: MyService, useValue: new MyService('different')}
            ],
            imports: [ControllerModule],
        });

        const serviceContainer = new ServiceContainer();
        serviceContainer.processRootModule(MyModule);
        const controllerContainer = new RpcControllerContainer(serviceContainer.rpcControllers);
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

    const DatabaseModule = createModule({
        providers: [Connection, HiddenDatabaseService],
        exports: [Connection]
    });

    class MyService {
    }

    const MyModule = createModule({
        providers: [MyService],
        imports: [DatabaseModule]
    });

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

        const MyModuleOverwritten = createModule({
            providers: [MyService, {provide: Connection, useClass: OverwrittenConnection}],
            imports: [DatabaseModule]
        });

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

    const DeepModule = createModule({
        providers: [DeepService]
    });

    class Connection {
    }

    class HiddenDatabaseService {
    }

    const DatabaseModule = createModule({
        providers: [Connection, HiddenDatabaseService],
        exports: [Connection],
        imports: [DeepModule]
    });

    class MyService {
    }

    const MyModule = createModule({
        providers: [MyService],
        imports: [DatabaseModule]
    });

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

    const MyModule = createModule({
        providers: [MyService, {provide: SessionHandler, scope: 'session'}],
    });

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

    const SharedModule = createModule({
        providers: [SharedService],
        exports: [SharedService]
    });

    @injectable()
    class BaseHandler {
        constructor(private sharedService: SharedService) {
            expect(sharedService).toBeInstanceOf(SharedService);
        }
    }

    const MyBaseModule = createModule({
        providers: [
            BaseHandler
        ],
        imports: [SharedModule],
    });

    const MyModule = createModule({
        imports: [
            MyBaseModule.forRoot()
        ]
    });

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

    @injectable()
    class ExchangeModuleBootstrap {
        constructor(protected config: ExchangeConfig) {
        }

        onBootstrapServer(): Promise<void> | void {
            bootstrapMainCalledConfig = this.config;
            expect(this.config).toBeInstanceOf(ExchangeConfig);
        }
    }

    const ExchangeModule = createModule({
        bootstrap: ExchangeModuleBootstrap,
        providers: [
            ExchangeConfig,
        ],
        exports: [
            ExchangeConfig,
        ]
    });

    const MyBaseModule = createModule({
        imports: [ExchangeModule]
    });

    {
        bootstrapMainCalledConfig = undefined;

        const MyModule = createModule({
            imports: [MyBaseModule.forRoot()]
        });

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

        const MyModule = createModule({});

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

        const MyModule = createModule({
            imports: [ExchangeModule]
        });

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

        const MyModule = createModule({
            providers: [
                {provide: ExchangeConfig, useValue: changedConfig}
            ],
            imports: [ExchangeModule]
        });

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

    const DatabaseModule = createModule({
        providers: [DatabaseConnection],
        exports: [
            DatabaseConnection
        ]
    });

    class FSService {
    }

    const FSModule = createModule({
        providers: [FSService],
        imports: [DatabaseModule],
        exports: [
            DatabaseModule
        ]
    });

    {
        const MyModule = createModule({
            imports: [FSModule]
        });

        const serviceContainer = new ServiceContainer();
        serviceContainer.processRootModule(MyModule);
        const rootInjector = serviceContainer.getRootContext().getInjector();

        expect(rootInjector.get(DatabaseConnection)).toBeInstanceOf(DatabaseConnection);

        const databaseModuleInjector = serviceContainer.getContextsForModule(DatabaseModule)[0].getInjector();
        expect(databaseModuleInjector.get(DatabaseConnection)).toBeInstanceOf(DatabaseConnection);
        expect(databaseModuleInjector.get(DatabaseConnection)).toBe(rootInjector.get(DatabaseConnection));
    }
});
