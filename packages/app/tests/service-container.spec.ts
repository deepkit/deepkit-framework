import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { injectable } from '@deepkit/injector';
import { AppModule } from '../src/module';
import { ServiceContainer } from '../src/service-container';

test('simple setup with import and overwrite', () => {
    class Connection {
    }

    @injectable()
    class HiddenDatabaseService {
        constructor(public connection: Connection) {
        }
    }

    const databaseModule = new AppModule({
        providers: [Connection, HiddenDatabaseService],
        exports: [Connection]
    });

    class MyService {
    }

    const myModule = new AppModule({
        providers: [MyService],
        imports: [databaseModule]
    });

    {
        const serviceContainer = new ServiceContainer(myModule);
        const injector = serviceContainer.getRootInjectorContext().getInjector(0);

        expect(injector.get(Connection)).toBeInstanceOf(Connection);
        expect(injector.get(MyService)).toBeInstanceOf(MyService);

        expect(() => injector.get(HiddenDatabaseService)).toThrow('Could not resolve injector token HiddenDatabaseService');
        expect(injector.get(MyService)).toBeInstanceOf(MyService);

        const databaseModuleInjector = serviceContainer.getInjectorFor(databaseModule);
        expect(databaseModuleInjector.get(HiddenDatabaseService)).toBeInstanceOf(HiddenDatabaseService);
        expect(databaseModuleInjector.get(Connection)).toBe(injector.get(Connection));

        const hiddenService = databaseModuleInjector.get(HiddenDatabaseService);
        expect(hiddenService.connection).toBe(injector.get(Connection));
        expect(hiddenService.connection).toBe(databaseModuleInjector.get(Connection));
    }

    {
        class OverwrittenConnection {
        }

        const myModuleOverwritten = new AppModule({
            providers: [MyService, { provide: Connection, useClass: OverwrittenConnection }],
            imports: [databaseModule]
        });

        const serviceContainer = new ServiceContainer(myModuleOverwritten);
        expect(serviceContainer.getRootInjectorContext().get(Connection)).toBeInstanceOf(OverwrittenConnection);

        const databaseModuleInjector = serviceContainer.getInjectorFor(databaseModule);
        const hiddenService = databaseModuleInjector.get(HiddenDatabaseService);
        expect(hiddenService.connection).toBeInstanceOf(OverwrittenConnection);
        expect(databaseModuleInjector.get(Connection)).toBeInstanceOf(OverwrittenConnection);
    }
});

test('deep', () => {
    class DeepService {
    }

    const deepModule = new AppModule({
        providers: [DeepService]
    });

    class Connection {
    }

    class HiddenDatabaseService {
    }

    const databaseModule = new AppModule({
        providers: [Connection, HiddenDatabaseService],
        exports: [Connection],
        imports: [deepModule]
    });

    class MyService {
    }

    const myModule = new AppModule({
        providers: [MyService],
        imports: [databaseModule]
    });

    const serviceContainer = new ServiceContainer(myModule);
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

    const myModule = new AppModule({
        providers: [MyService, { provide: SessionHandler, scope: 'rpc' }],
    });

    const serviceContainer = new ServiceContainer(myModule);
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

    const SharedModule = new AppModule({
        providers: [SharedService],
        exports: [SharedService]
    });

    @injectable()
    class BaseHandler {
        constructor(private sharedService: SharedService) {
            expect(sharedService).toBeInstanceOf(SharedService);
        }
    }

    const myBaseModule = new AppModule({
        providers: [
            BaseHandler
        ],
        imports: [SharedModule],
    });

    const myModule = new AppModule({
        imports: [
            myBaseModule.forRoot()
        ]
    });

    const serviceContainer = new ServiceContainer(myModule);
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

    const exchangeModule = new AppModule({
        bootstrap: ExchangeModuleBootstrap,
        providers: [
            ExchangeConfig,
        ],
        exports: [
            ExchangeConfig,
        ]
    });

    const myBaseModule = new AppModule({
        imports: [exchangeModule]
    });

    {
        bootstrapMainCalledConfig = undefined;

        const MyModule = new AppModule({
            imports: [myBaseModule.forRoot()]
        });

        const serviceContainer = new ServiceContainer(MyModule);
        expect(serviceContainer.getRootInjectorContext().get(ExchangeConfig)).toBeInstanceOf(ExchangeConfig);
        expect(bootstrapMainCalledConfig).toBeInstanceOf(ExchangeConfig);
    }

    {
        bootstrapMainCalledConfig = undefined;

        const MyModule = new AppModule({});

        const serviceContainer = new ServiceContainer(MyModule, [], [myBaseModule.forRoot()]);
        expect(serviceContainer.getRootInjectorContext().get(ExchangeConfig)).toBeInstanceOf(ExchangeConfig);
        expect(bootstrapMainCalledConfig).toBeInstanceOf(ExchangeConfig);
    }

    {
        bootstrapMainCalledConfig = undefined;

        const MyModule = new AppModule({
            imports: [exchangeModule]
        });

        const serviceContainer = new ServiceContainer(MyModule);
        expect(serviceContainer.getRootInjectorContext().get(ExchangeConfig)).toBeInstanceOf(ExchangeConfig);
        expect(bootstrapMainCalledConfig).toBeInstanceOf(ExchangeConfig);
    }

    {
        bootstrapMainCalledConfig = undefined;
        const changedConfig = new ExchangeConfig();
        changedConfig.startOnBootstrap = false;

        const MyModule = new AppModule({
            providers: [
                { provide: ExchangeConfig, useValue: changedConfig }
            ],
            imports: [exchangeModule]
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

    const databaseModule = new AppModule({
        providers: [DatabaseConnection],
        exports: [
            DatabaseConnection
        ]
    }, 'database');

    class FSService {
    }

    const FSModule = new AppModule({
        providers: [FSService],
        imports: [databaseModule],
        exports: [
            databaseModule
        ]
    }, 'fs');

    {
        const myModule = new AppModule({
            imports: [FSModule]
        }, 'myModule');

        const copy = myModule.clone();
        expect(copy.id).toBe(myModule.id);
        expect(copy.getImports()[0].id).toBe(FSModule.id);

        const serviceContainer = new ServiceContainer(myModule);
        const rootInjector = serviceContainer.getRootInjectorContext().getInjector(0);

        expect(rootInjector.get(DatabaseConnection)).toBeInstanceOf(DatabaseConnection);

        const databaseModuleInjector = serviceContainer.getInjectorFor(databaseModule);
        expect(databaseModuleInjector.get(DatabaseConnection)).toBeInstanceOf(DatabaseConnection);
        expect(databaseModuleInjector.get(DatabaseConnection)).toBe(rootInjector.get(DatabaseConnection));
    }
});
