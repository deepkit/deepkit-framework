import { expect, test } from '@jest/globals';
import { AppModule, createModuleClass } from '../src/module.js';
import { ServiceContainer } from '../src/service-container.js';
import { InjectorContext } from '@deepkit/injector';

test('simple setup with import and overwrite', () => {
    class Connection {
    }

    class HiddenDatabaseService {
        constructor(public connection: Connection) {
        }
    }

    class DatabaseModule extends createModuleClass({
        providers: [Connection, HiddenDatabaseService],
        exports: [Connection]
    }) {
    }

    class MyService {
    }

    const myModule = new AppModule({}, {
        providers: [MyService],
        imports: [new DatabaseModule]
    });

    {
        const serviceContainer = new ServiceContainer(myModule);
        const injector = serviceContainer.getRootInjector();

        expect(injector.get(Connection)).toBeInstanceOf(Connection);
        expect(injector.get(MyService)).toBeInstanceOf(MyService);

        expect(() => injector.get(HiddenDatabaseService)).toThrow('not found');
        expect(injector.get(MyService)).toBeInstanceOf(MyService);

        const databaseModuleInjector = serviceContainer.getInjector(DatabaseModule);
        expect(databaseModuleInjector.get(HiddenDatabaseService)).toBeInstanceOf(HiddenDatabaseService);
        expect(databaseModuleInjector.get(Connection)).toBe(injector.get(Connection));

        const hiddenService = databaseModuleInjector.get(HiddenDatabaseService);
        expect(hiddenService.connection).toBe(injector.get(Connection));
        expect(hiddenService.connection).toBe(databaseModuleInjector.get(Connection));
    }

    {
        class OverwrittenConnection {
        }

        const myModuleOverwritten = new AppModule({}, {
            providers: [MyService, { provide: Connection, useClass: OverwrittenConnection }],
            imports: [new DatabaseModule]
        });

        const serviceContainer = new ServiceContainer(myModuleOverwritten);
        expect(serviceContainer.getInjectorContext().get(Connection)).toBeInstanceOf(OverwrittenConnection);

        const databaseModuleInjector = serviceContainer.getInjector(DatabaseModule);
        const hiddenService = databaseModuleInjector.get(HiddenDatabaseService);
        expect(hiddenService.connection).toBeInstanceOf(OverwrittenConnection);
        expect(databaseModuleInjector.get(Connection)).toBeInstanceOf(OverwrittenConnection);
    }
});

test('deep', () => {
    class DeepService {
    }

    const deepModule = new AppModule({}, {
        providers: [DeepService]
    });

    class Connection {
    }

    class HiddenDatabaseService {
    }

    const databaseModule = new AppModule({}, {
        providers: [Connection, HiddenDatabaseService],
        exports: [Connection],
        imports: [deepModule]
    });

    class MyService {
    }

    const myModule = new AppModule({}, {
        providers: [MyService],
        imports: [databaseModule]
    });

    const serviceContainer = new ServiceContainer(myModule);
    const injector = serviceContainer.getInjectorContext();

    expect(injector.get(Connection)).toBeInstanceOf(Connection);
    expect(injector.get(MyService)).toBeInstanceOf(MyService);

    expect(() => injector.get(HiddenDatabaseService)).toThrow('not found');
    expect(() => injector.get(DeepService)).toThrow('not found');
    expect(injector.get(MyService)).toBeInstanceOf(MyService);
});


test('scopes', () => {
    class MyService {
    }

    class SessionHandler {
    }

    const myModule = new AppModule({}, {
        providers: [MyService, { provide: SessionHandler, scope: 'rpc' }],
    });

    const serviceContainer = new ServiceContainer(myModule);
    const sessionInjector = serviceContainer.getInjectorContext().createChildScope('rpc');

    expect(() => serviceContainer.getInjectorContext().get(SessionHandler)).toThrow(`Service 'SessionHandler' is known but has no value`);
    expect(sessionInjector.get(SessionHandler)).toBeInstanceOf(SessionHandler);

    expect(serviceContainer.getInjectorContext().get(MyService)).toBeInstanceOf(MyService);
    expect(sessionInjector.get(MyService)).toBeInstanceOf(MyService);
    expect(serviceContainer.getInjectorContext().get(MyService)).toBe(sessionInjector.get(MyService));
});


test('for root with exported module', () => {
    class SharedService {
    }

    const SharedModule = new AppModule({}, {
        providers: [SharedService],
        exports: [SharedService]
    });

    class BaseHandler {
        constructor(private sharedService: SharedService) {
            expect(sharedService).toBeInstanceOf(SharedService);
        }
    }

    const myBaseModule = new AppModule({}, {
        providers: [
            BaseHandler
        ],
        imports: [SharedModule],
    });

    const myModule = new AppModule({}, {
        imports: [
            myBaseModule.forRoot()
        ]
    });

    const serviceContainer = new ServiceContainer(myModule);
    const injector = serviceContainer.getInjectorContext();

    expect(injector.get(BaseHandler)).toBeInstanceOf(BaseHandler);
    expect(injector.get(SharedService)).toBeInstanceOf(SharedService);
});

test('module with config object', () => {
    class ExchangeConfig {
        public startOnBootstrap: boolean = true;
    }

    let bootstrapMainCalledConfig: any;

    class ExchangeModuleBootstrap {
        constructor(protected config: ExchangeConfig) {
            bootstrapMainCalledConfig = this.config;
            expect(this.config).toBeInstanceOf(ExchangeConfig);
        }
    }

    class ExchangeModule extends createModuleClass({
        bootstrap: ExchangeModuleBootstrap,
        providers: [
            ExchangeConfig,
        ],
        exports: [
            ExchangeConfig,
        ]
    }) {
    }

    const myBaseModule = new AppModule({}, {
        imports: [new ExchangeModule]
    });

    {
        bootstrapMainCalledConfig = undefined;

        const MyModule = new AppModule({}, {
            imports: [myBaseModule.forRoot()]
        });

        const serviceContainer = new ServiceContainer(MyModule);
        expect(serviceContainer.getInjectorContext().get(ExchangeConfig)).toBeInstanceOf(ExchangeConfig);
        expect(bootstrapMainCalledConfig).toBeInstanceOf(ExchangeConfig);
    }

    {
        bootstrapMainCalledConfig = undefined;

        const MyModule = new AppModule({}, {
            imports: [new ExchangeModule]
        });

        const serviceContainer = new ServiceContainer(MyModule);
        expect(serviceContainer.getInjectorContext().get(ExchangeConfig)).toBeInstanceOf(ExchangeConfig);
        expect(bootstrapMainCalledConfig).toBeInstanceOf(ExchangeConfig);
    }

    {
        bootstrapMainCalledConfig = undefined;
        const changedConfig = new ExchangeConfig();
        changedConfig.startOnBootstrap = false;

        const MyModule = new AppModule({}, {
            providers: [
                { provide: ExchangeConfig, useValue: changedConfig }
            ],
            imports: [new ExchangeModule]
        });

        const serviceContainer = new ServiceContainer(MyModule);
        expect(serviceContainer.getInjectorContext().get(ExchangeConfig)).toBeInstanceOf(ExchangeConfig);
        expect(bootstrapMainCalledConfig).toBeInstanceOf(ExchangeConfig);
        expect(bootstrapMainCalledConfig).toBe(changedConfig);
    }
});

test('exported module', () => {
    class DatabaseConnection {
    }

    class DatabaseModule extends createModuleClass({
        providers: [DatabaseConnection],
        exports: [
            DatabaseConnection
        ]
    }) {
    }

    class FSService {
    }

    class FSModule extends createModuleClass({
        providers: [FSService],
        exports: [
            DatabaseModule
        ]
    }) {
        imports = [new DatabaseModule];
    }

    {
        const myModule = new AppModule({}, {
            imports: [new FSModule]
        });

        const serviceContainer = new ServiceContainer(myModule);
        const rootInjector = serviceContainer.getRootInjector();

        expect(rootInjector.get(DatabaseConnection)).toBeInstanceOf(DatabaseConnection);

        const databaseModuleInjector = serviceContainer.getInjector(DatabaseModule);
        expect(databaseModuleInjector.get(DatabaseConnection)).toBeInstanceOf(DatabaseConnection);
        expect(databaseModuleInjector.get(DatabaseConnection)).toBe(rootInjector.get(DatabaseConnection));
    }
});

test('scoped InjectorContext access', () => {
    class RpcInjectorContext extends InjectorContext {
    }

    class MyService {
        constructor(public injectorContext: InjectorContext) {
        }
    }

    const myModule = new AppModule({}, {
        providers: [
            { provide: MyService },
            { provide: RpcInjectorContext, scope: 'rpc', useValue: undefined },
        ]
    });

    const serviceContainer = new ServiceContainer(myModule);
    {
        const injector = serviceContainer.getInjectorContext();
        const myService = injector.get(MyService);
        expect(myService.injectorContext).toBeInstanceOf(InjectorContext);
    }

    {
        const injector = serviceContainer.getInjectorContext().createChildScope('rpc');
        injector.set(RpcInjectorContext, injector);

        const myService = injector.get(MyService);
        expect(myService.injectorContext).toBeInstanceOf(InjectorContext);
    }
});
