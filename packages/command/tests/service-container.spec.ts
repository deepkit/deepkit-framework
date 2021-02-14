import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { injectable } from '@deepkit/injector';
import { createModule } from '../src/module';
import { ServiceContainer } from '../src/service-container';

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
        const serviceContainer = new ServiceContainer(MyModule);
        const injector = serviceContainer.getRootInjectorContext().getInjector(0);

        expect(injector.get(Connection)).toBeInstanceOf(Connection);
        expect(injector.get(MyService)).toBeInstanceOf(MyService);

        expect(() => injector.get(HiddenDatabaseService)).toThrow('Could not resolve injector token HiddenDatabaseService');
        expect(injector.get(MyService)).toBeInstanceOf(MyService);

        const databaseModuleInjector = serviceContainer.getInjectorFor(DatabaseModule);
        expect(databaseModuleInjector.get(HiddenDatabaseService)).toBeInstanceOf(HiddenDatabaseService);
        expect(databaseModuleInjector.get(Connection)).toBe(injector.get(Connection));

        const hiddenService = databaseModuleInjector.get(HiddenDatabaseService);
        expect(hiddenService.connection).toBe(injector.get(Connection));
        expect(hiddenService.connection).toBe(databaseModuleInjector.get(Connection));
    }

    {
        class OverwrittenConnection {
        }

        const MyModuleOverwritten = createModule({
            providers: [MyService, { provide: Connection, useClass: OverwrittenConnection }],
            imports: [DatabaseModule]
        });

        const serviceContainer = new ServiceContainer(MyModuleOverwritten);
        expect(serviceContainer.getRootInjectorContext().get(Connection)).toBeInstanceOf(OverwrittenConnection);

        const databaseModuleInjector = serviceContainer.getInjectorFor(DatabaseModule);
        const hiddenService = databaseModuleInjector.get(HiddenDatabaseService);
        expect(hiddenService.connection).toBeInstanceOf(OverwrittenConnection);
        expect(databaseModuleInjector.get(Connection)).toBeInstanceOf(OverwrittenConnection);
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

    const serviceContainer = new ServiceContainer(MyModule);
    const injector = serviceContainer.getRootInjectorContext();

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
        providers: [MyService, { provide: SessionHandler, scope: 'rpc' }],
    });

    const serviceContainer = new ServiceContainer(MyModule);
    const sessionInjector = serviceContainer.getRootInjectorContext().createChildScope('rpc');

    expect(() => serviceContainer.getRootInjectorContext().get(SessionHandler)).toThrow('Could not resolve');
    expect(sessionInjector.get(SessionHandler)).toBeInstanceOf(SessionHandler);

    expect(serviceContainer.getRootInjectorContext().get(MyService)).toBeInstanceOf(MyService);
    expect(sessionInjector.get(MyService)).toBeInstanceOf(MyService);
    expect(serviceContainer.getRootInjectorContext().get(MyService)).toBe(sessionInjector.get(MyService));
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

    const serviceContainer = new ServiceContainer(MyModule);
    const injector = serviceContainer.getRootInjectorContext();

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

        const serviceContainer = new ServiceContainer(MyModule);
        expect(serviceContainer.getRootInjectorContext().get(ExchangeConfig)).toBeInstanceOf(ExchangeConfig);
        expect(bootstrapMainCalledConfig).toBeInstanceOf(ExchangeConfig);
    }

    {
        bootstrapMainCalledConfig = undefined;

        const MyModule = createModule({});

        const serviceContainer = new ServiceContainer(MyModule, [], [MyBaseModule.forRoot()]);
        expect(serviceContainer.getRootInjectorContext().get(ExchangeConfig)).toBeInstanceOf(ExchangeConfig);
        expect(bootstrapMainCalledConfig).toBeInstanceOf(ExchangeConfig);
    }

    {
        bootstrapMainCalledConfig = undefined;

        const MyModule = createModule({
            imports: [ExchangeModule]
        });

        const serviceContainer = new ServiceContainer(MyModule);
        expect(serviceContainer.getRootInjectorContext().get(ExchangeConfig)).toBeInstanceOf(ExchangeConfig);
        expect(bootstrapMainCalledConfig).toBeInstanceOf(ExchangeConfig);
    }

    {
        bootstrapMainCalledConfig = undefined;
        const changedConfig = new ExchangeConfig();
        changedConfig.startOnBootstrap = false;

        const MyModule = createModule({
            providers: [
                { provide: ExchangeConfig, useValue: changedConfig }
            ],
            imports: [ExchangeModule]
        });

        const serviceContainer = new ServiceContainer(MyModule);
        expect(serviceContainer.getRootInjectorContext().get(ExchangeConfig)).toBeInstanceOf(ExchangeConfig);
        expect(bootstrapMainCalledConfig).toBeInstanceOf(ExchangeConfig);
        expect(bootstrapMainCalledConfig).toBe(changedConfig);
    }
});

test('exported module', () => {
    class DatabaseConnection {
    }

    const DatabaseModule = createModule({
        name: 'database',
        providers: [DatabaseConnection],
        exports: [
            DatabaseConnection
        ]
    });

    class FSService {
    }

    const FSModule = createModule({
        name: 'fs',
        providers: [FSService],
        imports: [DatabaseModule],
        exports: [
            DatabaseModule
        ]
    });

    {
        const MyModule = createModule({
            name: 'myModule',
            imports: [FSModule]
        });

        const copy = MyModule.clone();
        expect(copy.id).toBe(MyModule.id);
        expect(copy.getImports()[0].id).toBe(FSModule.id);

        const serviceContainer = new ServiceContainer(MyModule);
        const rootInjector = serviceContainer.getRootInjectorContext().getInjector(0);

        expect(rootInjector.get(DatabaseConnection)).toBeInstanceOf(DatabaseConnection);

        const databaseModuleInjector = serviceContainer.getInjectorFor(DatabaseModule);
        expect(databaseModuleInjector.get(DatabaseConnection)).toBeInstanceOf(DatabaseConnection);
        expect(databaseModuleInjector.get(DatabaseConnection)).toBe(rootInjector.get(DatabaseConnection));
    }
});
