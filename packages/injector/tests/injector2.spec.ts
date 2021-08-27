import 'reflect-metadata';
import { expect, test } from '@jest/globals';
import { InjectorContext, InjectorModule } from '../src/injector';
import { injectable } from '../src/decorator';
import { getClassSchema, t } from '@deepkit/type';
import { Tag } from '../src/provider';

test('basic', () => {
    class Service {
    }

    const module1 = new InjectorModule([Service]);

    const context = new InjectorContext(module1);
    const injector = context.getInjector(module1);
    expect(injector.get(Service)).toBeInstanceOf(Service);
    expect(injector.get(Service) === injector.get(Service)).toBe(true);
});

test('parent dependency', () => {
    class Router {
    }

    @injectable
    class Controller {
        constructor(public router: Router) {
        }
    }

    const schema = getClassSchema(Controller);
    const props = schema.getMethodProperties('constructor');
    expect(props[0].type).toBe('class');

    const module1 = new InjectorModule([Router]);
    const module2 = new InjectorModule([Controller], module1);

    const context = new InjectorContext(module1);
    const injector = context.getInjector(module2);
    expect(injector.get(Controller)).toBeInstanceOf(Controller);
});

test('scoped provider', () => {
    class Service {
    }

    const module1 = new InjectorModule([{ provide: Service, scope: 'http' }]);

    const context = new InjectorContext(module1);
    const injector = context.getInjector(module1);
    expect(() => injector.get(Service)).toThrow('not found');

    expect(context.createChildScope('http').get(Service)).toBeInstanceOf(Service);

    const scope = { name: 'http', instances: {} };

    expect(injector.get(Service, scope)).toBeInstanceOf(Service);
    expect(injector.get(Service, scope) === injector.get(Service, scope)).toBe(true);
});

test('scoped provider with dependency to unscoped', () => {
    class Service {
    }

    const module1 = new InjectorModule([{ provide: Service, scope: 'http' }]);

    const context = new InjectorContext(module1);
    const injector = context.getInjector(module1);
    expect(() => injector.get(Service)).toThrow('not found');

    const scope = context.createChildScope('http');
    expect(scope.get(Service)).toBeInstanceOf(Service);
    expect(scope.get(Service) === scope.get(Service)).toBe(true);
});

test('reset', () => {
    class Service {
    }

    const module1 = new InjectorModule([Service]);

    const context = new InjectorContext(module1);
    const injector = context.getInjector(module1);
    const service1 = injector.get(Service);
    expect(service1).toBeInstanceOf(Service);
    expect(injector.get(Service) === injector.get(Service)).toBe(true);

    injector.clear();
    const service2 = injector.get(Service);
    expect(service2).toBeInstanceOf(Service);
    expect(service2 === service1).toBe(false);
    expect(service2 === injector.get(Service)).toBe(true);
});


test('scopes', () => {
    class Service {
    }

    const module1 = new InjectorModule([{ provide: Service, scope: 'http' }]);
    const context = new InjectorContext(module1);

    const scope1 = context.createChildScope('http');
    const scope2 = context.createChildScope('http');

    expect(scope1.get(Service, module1)).toBeInstanceOf(Service);
    expect(scope1.get(Service, module1) === scope1.get(Service, module1)).toBe(true);

    expect(scope2.get(Service, module1)).toBeInstanceOf(Service);
    expect(scope2.get(Service, module1) === scope2.get(Service, module1)).toBe(true);

    expect(scope1.get(Service, module1) === scope2.get(Service, module1)).toBe(false);
});

test('tags', () => {
    class ServiceA {
    }

    class ServiceB {
    }

    class ServiceC {
        collect() {

        }
    }

    interface Collector {
        collect(): void;
    }

    class CollectorTag extends Tag<Collector> {
    }

    @injectable
    class CollectorManager {
        constructor(protected collectors: CollectorTag) {
        }

        getCollectors(): Collector[] {
            return this.collectors.services;
        }
    }

    const module1 = new InjectorModule([CollectorManager, ServiceA, ServiceB, CollectorTag.provide(ServiceC)]);
    const context = new InjectorContext(module1);

    const collector = context.getInjector(module1).get(CollectorManager).getCollectors();
    expect(collector).toHaveLength(1);
    expect(collector[0]).toBeInstanceOf(ServiceC);
});

test('scope late binding', () => {
    let createdSessions: number = 0;
    let createdRequests: number = 0;

    class Session {
        constructor() {
            createdSessions++;
        }
    }

    class Request {
        constructor() {
            createdRequests++;
        }
    }

    @injectable
    class Controller {
        constructor(public session: Session, public request: Request) {
        }
    }

    const root1 = new InjectorModule([
        { provide: Session, scope: 'http' },
        { provide: Request, scope: 'http' },
    ]);

    const module1 = new InjectorModule([{ provide: Controller, scope: 'http' }], root1);

    const request = new Request();
    for (let i = 0; i < 10; i++) {
        const context = new InjectorContext(root1).createChildScope('http');

        context.set(Request, request, root1);

        const controller = context.get(Controller, module1);
        expect(controller.request === request).toBe(true);

        expect(createdSessions).toBe(i + 1);
        expect(createdRequests).toBe(1);
    }
});

test('all same scope', () => {
    class RpcKernelConnection {
    }

    @injectable
    class Controller {
        constructor(public connection: RpcKernelConnection) {
        }
    }

    const injector = InjectorContext.forProviders([
        { provide: RpcKernelConnection, scope: 'rpc' },
        { provide: Controller, scope: 'rpc' },
    ]);

    const controller = injector.createChildScope('rpc').get(Controller);
    expect(controller).toBeInstanceOf(Controller);
});


test('exports have access to encapsulated module', () => {
    //for exports its important that exported providers still have access to the encapsulated module they were defined in.
    class ServiceHelper {
    }

    @injectable
    class Service {
        constructor(public helper: ServiceHelper) {
        }
    }

    @injectable
    class Controller {
        constructor(public service: Service) {
        }
    }

    {
        const root = new InjectorModule([Controller]);

        const module1 = new InjectorModule([
            Service, ServiceHelper
        ], root, {}, [Service]);

        const injector = new InjectorContext(root);

        const controller = injector.get(Controller);
        expect(controller).toBeInstanceOf(Controller);
        expect(controller.service).toBeInstanceOf(Service);
        expect(controller.service.helper).toBeInstanceOf(ServiceHelper);

        expect(injector.get(Service) === controller.service).toBe(true);
        expect(() => injector.get(ServiceHelper)).toThrow('not found');
        expect(injector.get(ServiceHelper, module1) === controller.service.helper).toBe(true);
    }

    {
        class RootModule extends InjectorModule {
        }

        class MiddleMan extends InjectorModule {
        }

        class ServiceModule extends InjectorModule {
        }

        const root = new RootModule([Controller]);

        const module1 = new MiddleMan([], root, {}, []);

        const module2 = new ServiceModule([
            Service, ServiceHelper
        ], module1, {}, [Service]);

        module1.exports = [module2];

        const injector = new InjectorContext(root);

        const controller = injector.get(Controller);
        expect(controller).toBeInstanceOf(Controller);
        expect(controller.service).toBeInstanceOf(Service);
        expect(controller.service.helper).toBeInstanceOf(ServiceHelper);

        expect(injector.get(Service) === controller.service).toBe(true);
        expect(() => injector.get(ServiceHelper)).toThrow('not found');
        expect(injector.get(ServiceHelper, module2) === controller.service.helper).toBe(true);
    }

    {
        class RootModule extends InjectorModule {
        }

        class MiddleMan1 extends InjectorModule {
        }

        class MiddleMan2 extends InjectorModule {
        }

        class ServiceModule extends InjectorModule {
        }

        const root = new RootModule([Controller]);

        const module1 = new MiddleMan1([], root, {}, []);

        const module2 = new MiddleMan2([], root, {}, []);

        const module3 = new ServiceModule([
            Service, ServiceHelper
        ], module2, {}, [Service]);

        module1.exports = [module2];
        module2.exports = [module3];

        const injector = new InjectorContext(root);

        const controller = injector.get(Controller);
        expect(controller).toBeInstanceOf(Controller);
        expect(controller.service).toBeInstanceOf(Service);
        expect(controller.service.helper).toBeInstanceOf(ServiceHelper);

        expect(injector.get(Service) === controller.service).toBe(true);
        expect(() => injector.get(ServiceHelper)).toThrow('not found');
        expect(injector.get(ServiceHelper, module3) === controller.service.helper).toBe(true);
    }
});


test('useClass redirects and does not create 2 instances when its already provided', () => {
    class DefaultStrategy {
    }

    class SpecialisedStrategy {
    }

    {
        const root = new InjectorModule([
            DefaultStrategy,
            { provide: DefaultStrategy, useClass: SpecialisedStrategy }
        ]);

        const injector = new InjectorContext(root);

        const defaultStrategy = injector.get(DefaultStrategy);
        expect(defaultStrategy).toBeInstanceOf(SpecialisedStrategy);
        //useClass does not get their own token.
        expect(() => injector.get(SpecialisedStrategy)).toThrow('not found');
    }

    {
        const root = new InjectorModule([
            SpecialisedStrategy,
            { provide: DefaultStrategy, useClass: SpecialisedStrategy }
        ]);

        const injector = new InjectorContext(root);

        const defaultStrategy = injector.get(DefaultStrategy);
        expect(defaultStrategy).toBeInstanceOf(SpecialisedStrategy);
        //because useClass it not the same as useExisting
        expect(defaultStrategy === injector.get(SpecialisedStrategy)).toBe(false);
    }

    {
        const root = new InjectorModule([
            SpecialisedStrategy,
            { provide: DefaultStrategy, useExisting: SpecialisedStrategy }
        ]);

        const injector = new InjectorContext(root);

        const defaultStrategy = injector.get(DefaultStrategy);
        expect(defaultStrategy).toBeInstanceOf(SpecialisedStrategy);
        expect(defaultStrategy === injector.get(SpecialisedStrategy)).toBe(true);
    }
});

test('scope merging', () => {
    class Request {
    }

    const root = new InjectorModule([
        { provide: Request, scope: 'rpc' },
        { provide: Request, scope: 'http' },
    ]);

    const injector = new InjectorContext(root);

    {
        expect(injector.createChildScope('rpc').get(Request)).toBeInstanceOf(Request);
        expect(injector.createChildScope('http').get(Request)).toBeInstanceOf(Request);
        expect(() => injector.createChildScope('unknown').get(Request)).toThrow('not found');
    }
});

test('forRoot', () => {
    class Router {}

    @injectable
    class Controller {
        constructor(public router: Router) {
        }
    }

    {
        const root = new InjectorModule([
            Controller,
        ]);

        const module1 = new InjectorModule([
            Router
        ], root, {}, []).forRoot();

        const injector = new InjectorContext(root);
        const controller = injector.get(Controller);

        expect(controller).toBeInstanceOf(Controller);
        expect(controller.router).toBeInstanceOf(Router);

        expect(controller.router === injector.get(Router, module1)).toBe(true);
    }

    {
        const root = new InjectorModule([
            Controller,
        ]);

        const module1 = new InjectorModule([
        ], root, {}, []);

        const module2 = new InjectorModule([
            Router
        ], module1, {}, []).forRoot();

        const injector = new InjectorContext(root);
        const controller = injector.get(Controller);

        expect(controller).toBeInstanceOf(Controller);
        expect(controller.router).toBeInstanceOf(Router);

        expect(controller.router === injector.get(Router, module2)).toBe(true);
    }
});

test('disableExports', () => {
    class Router {}

    @injectable
    class Controller {
        constructor(@t.optional public router?: Router) {
        }
    }

    {
        const root = new InjectorModule([
            Controller,
        ]);

        const module1 = new InjectorModule([
            Router
        ], root, {}, []).disableExports();

        const injector = new InjectorContext(root);
        const controller = injector.get(Controller);

        expect(controller).toBeInstanceOf(Controller);
        expect(controller.router).toBe(undefined);

        expect(injector.get(Router, module1)).toBeInstanceOf(Router);
    }
});

test('unscoped to scope dependency invalid', () => {
    class HttpRequest {}

    @injectable
    class Controller {
        constructor(public request: HttpRequest) {
        }
    }

    {
        const root = new InjectorModule([
            Controller, {provide: HttpRequest, scope: 'http'},
        ]);

        const injector = new InjectorContext(root);
        const scope = injector.createChildScope('http');
        expect(() => scope.get(Controller)).toThrow('scope invalid');
    }
});
