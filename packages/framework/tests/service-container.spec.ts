import { expect, test } from '@jest/globals';
import { rpc } from '@deepkit/rpc';
import { App, AppModule, createModule, ServiceContainer } from '@deepkit/app';
import { FrameworkModule } from '../src/module';
import { Database, DatabaseEvent, DatabaseRegistry, MemoryDatabaseAdapter, Query } from '@deepkit/orm';
import { EventDispatcher } from '@deepkit/event';
import { PrimaryKey } from '@deepkit/type';

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
        const myModule = new AppModule({
            providers: [MyService],
            controllers: [MyController],
            imports: [
                new FrameworkModule()
            ]
        });

        const serviceContainer = new ServiceContainer(myModule);
        const rpcScopedContext = serviceContainer.getInjectorContext().createChildScope('rpc');
        const controller = rpcScopedContext.get(MyController, myModule);
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

    class ControllerModule extends createModule({
        providers: [MyService],
        controllers: [MyController],
        exports: [
            MyService
        ]
    }, 'controller') {
    }

    {
        const myModule = new AppModule({
            imports: [new ControllerModule, new FrameworkModule()],
        });

        const serviceContainer = new ServiceContainer(myModule);
        const rpcScopedContext = serviceContainer.getInjectorContext().createChildScope('rpc');
        const controller = rpcScopedContext.get(MyController, serviceContainer.getModule(ControllerModule));
        expect(controller).toBeInstanceOf(MyController);
        expect(controller.foo()).toBe('hello');
    }

    {
        const myModule = new AppModule({
            providers: [
                { provide: MyService, useValue: new MyService('different') }
            ],
            imports: [new ControllerModule, new FrameworkModule()],
        });

        const serviceContainer = new ServiceContainer(myModule);
        const rpcScopedContext = serviceContainer.getInjectorContext().createChildScope('rpc');
        const controller = rpcScopedContext.get(MyController, serviceContainer.getModule(ControllerModule));
        expect(controller).toBeInstanceOf(MyController);
        expect(controller.foo()).toBe('different');
    }
});

test('database integration', async () => {
    class MyDatabase extends Database {
        constructor() {
            super(new MemoryDatabaseAdapter());
        }
    }

    const onFetch: DatabaseEvent[] = [];

    const app = new App({
        providers: [MyDatabase],
        listeners: [
            Query.onFetch.listen(event => {
                onFetch.push(event);
            })
        ],
        imports: [new FrameworkModule()]
    });

    const eventDispatcher = app.get(EventDispatcher);

    const registry = app.get(DatabaseRegistry);
    const dbs = registry.getDatabases();
    expect(dbs).toHaveLength(1);
    for (const db of dbs) {
        expect(db).toBeInstanceOf(Database);
        expect(db.eventDispatcher == eventDispatcher).toBe(true);
    }

    class User {
        id: number & PrimaryKey = 0;
    }

    const db = dbs[0];
    const all = await db.query(User).find();

    expect(onFetch).toHaveLength(1);
    expect(onFetch[0]).toBeInstanceOf(DatabaseEvent);
});

test('database injection', () => {
    class Service {
        constructor(public db: Database) {
        }
    }

    const app = new App({
        imports: [new FrameworkModule({ debug: true })],
        providers: [Service, { provide: Database, useValue: new Database(new MemoryDatabaseAdapter()) }],
    });

    const db = app.get(Database);
    expect(db).toBeInstanceOf(Database);

    const service = app.get(Service);
    expect(service.db).toBeInstanceOf(Database);

    const registry = app.get(DatabaseRegistry);
    expect(registry.getDatabases()).toHaveLength(1);
});
