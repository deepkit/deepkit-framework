import 'jest';
import 'jest-extended';
import 'reflect-metadata';
import {Module} from "../src/module";
import {ServiceContainer} from "../src/service-container";
import {injectable} from "../src/injector/injector";


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
    const injector = serviceContainer.getRootContext().createInjector('session');

    expect(injector.get(MyService)).toBeInstanceOf(MyService);
    expect(injector.get(SessionHandler)).toBeInstanceOf(SessionHandler);
});
