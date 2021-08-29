import 'reflect-metadata';
import { expect, test } from '@jest/globals';
import { InjectorContext } from '../src/injector';
import { inject, injectable, injectorReference, InjectorToken } from '../src/decorator';
import { getClassSchema, t } from '@deepkit/type';
import { Tag } from '../src/provider';
import { ConfigDefinition } from '../src/config';
import { InjectorModule } from '../src/module';

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

        const module2 = new MiddleMan2([], module1, {}, []);

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
        constructor(public id: number) {
        }
    }

    const root = new InjectorModule([
        { provide: Request, useValue: new Request(-1) },
        { provide: Request, useValue: new Request(0), scope: 'rpc' },
        { provide: Request, useValue: new Request(1), scope: 'http' },
        { provide: Request, useValue: new Request(2), scope: 'http' },
    ]);

    const injector = new InjectorContext(root);
    injector.getInjector(root); //trigger build
    const preparedProvider = root.getPreparedProvider(Request);
    expect(preparedProvider!.providers).toHaveLength(3);
    expect(preparedProvider!.providers[0].scope).toBe('rpc');
    expect(preparedProvider!.providers[1].scope).toBe('http');
    expect(preparedProvider!.providers[2].scope).toBe(undefined);

    {
        const request1 = injector.createChildScope('rpc').get(Request);
        expect(request1).toBeInstanceOf(Request);
        expect(request1.id).toBe(0);

        const request2 = injector.createChildScope('http').get(Request);
        expect(request2).toBeInstanceOf(Request);
        expect(request2.id).toBe(2); //last provider is used

        const request3 = injector.createChildScope('unknown').get(Request);
        expect(request3).toBeInstanceOf(Request);
        expect(request3.id).toBe(-1); //unscoped
    }
});

test('forRoot', () => {
    class Router {
    }

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

        const module1 = new InjectorModule([], root, {}, []);

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
    class Router {
    }

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
    class HttpRequest {
    }

    @injectable
    class Controller {
        constructor(public request: HttpRequest) {
        }
    }

    {
        const root = new InjectorModule([
            Controller, { provide: HttpRequest, scope: 'http' },
        ]);

        const injector = new InjectorContext(root);

        const scope = injector.createChildScope('http');
        expect(() => scope.get(Controller)).toThrow(`Dependency 'request: HttpRequest' of Controller.request can not be injected into no scope, since HttpRequest only exists in scope http`);
    }
});

test('non-exported dependencies can not be overwritten', () => {
    class Encapsulated {
    }

    @injectable
    class Service {
        constructor(public encapsulated: Encapsulated) {
        }
    }

    @injectable
    class Controller {
        constructor(public service: Service) {
        }
    }

    {
        const root = new InjectorModule([
            Controller
        ]);

        const serviceModule = new InjectorModule([
            Service, Encapsulated,
        ], root, {}, [Service]);

        const injector = new InjectorContext(root);

        const controller = injector.get(Controller);
        expect(controller.service).toBeInstanceOf(Service);
        expect(controller.service.encapsulated).toBeInstanceOf(Encapsulated);
    }

    {
        @injectable
        class MyService {
            constructor(public encapsulated: Encapsulated) {
            }
        }

        const root = new InjectorModule([
            Controller, { provide: Service, useClass: MyService }
        ]);

        const serviceModule = new InjectorModule([
            Service, Encapsulated,
        ], root, {}, [Service]);

        const injector = new InjectorContext(root);

        const controller = injector.get(Controller);
        expect(controller.service).toBeInstanceOf(MyService);
        expect(controller.service.encapsulated).toBeInstanceOf(Encapsulated);
    }

    {
        class MyEncapsulated {
        }

        @injectable
        class MyService {
            constructor(public encapsulated: Encapsulated) {
            }
        }

        const root = new InjectorModule([
            Controller,
            { provide: Service, useClass: MyService },
            { provide: Encapsulated, useClass: MyEncapsulated },
        ]);

        const serviceModule = new InjectorModule([
            Service, Encapsulated,
        ], root, {}, [Service]);

        const injector = new InjectorContext(root);

        const controller = injector.get(Controller);
        expect(controller.service).toBeInstanceOf(MyService);

        //since Encapsulated was not exported, it can not be overwritten.
        expect(controller.service.encapsulated).toBeInstanceOf(Encapsulated);
    }
});

test('forRoot module keeps reference to config', () => {
    const config = new ConfigDefinition(t.schema({
        listen: t.string
    }));

    @injectable
    class Service {
        constructor(@inject(config.token('listen')) public listen: string) {
        }
    }

    class MyModule extends InjectorModule {
    }

    const root = new InjectorModule([]);

    const module = new MyModule([
        Service
    ], root, { listen: 'localhost' }).forRoot().setConfigDefinition(config);

    const injector = new InjectorContext(root);

    const service = injector.get(Service, module);

    expect(service).toBeInstanceOf(Service);
    expect(service.listen).toBe('localhost');
});

test('setup provider', () => {
    class Service {
        list: any[] = [];

        add(item: any) {
            this.list.push(item);
        }
    }

    const root = new InjectorModule([Service]);

    root.setupProvider(Service).add('a');
    root.setupProvider(Service).add('b');

    const injector = new InjectorContext(root);
    const service = injector.get(Service);

    expect(service.list).toEqual(['a', 'b']);
});


test('setup provider in sub module', () => {
    class Service {
        list: any[] = [];

        add(item: any) {
            this.list.push(item);
        }
    }

    const root = new InjectorModule([]);
    const module = new InjectorModule([Service], root);

    module.setupProvider(Service).add('a');
    module.setupProvider(Service).add('b');

    const injector = new InjectorContext(root);
    const service = injector.get(Service, module);

    expect(service.list).toEqual(['a', 'b']);
});

test('setup provider in exported sub module', () => {
    class Service {
        list: any[] = [];

        add(item: any) {
            this.list.push(item);
        }
    }

    const root = new InjectorModule([]);
    const module = new InjectorModule([Service], root, {}, [Service]);

    module.setupProvider(Service).add('a');
    module.setupProvider(Service).add('b');

    const injector = new InjectorContext(root);
    const service = injector.get(Service);

    expect(service.list).toEqual(['a', 'b']);
});

test('global setup provider', () => {
    class Service {
        list: any[] = [];

        add(item: any) {
            this.list.push(item);
        }
    }

    const root = new InjectorModule([Service]);

    const module = new InjectorModule([], root);

    module.setupGlobalProvider(Service).add('a');
    module.setupGlobalProvider(Service).add('b');

    const injector = new InjectorContext(root);
    const service = injector.get(Service);

    expect(service.list).toEqual(['a', 'b']);
});

test('second forRoot modules overwrites first forRoot providers', () => {
    class Service {
    }

    class NewService {
    }

    const root = new InjectorModule([]);

    //the order in which imports are added is important. Last imports have higher importance.
    const module1 = new InjectorModule([Service], root).forRoot();
    const module2 = new InjectorModule([{ provide: Service, useClass: NewService }], root).forRoot();

    const injector = new InjectorContext(root);
    const service = injector.get(Service);

    expect(service).toBeInstanceOf(NewService);
});

test('set service', () => {
    class Service {
    }

    const injector = InjectorContext.forProviders([
        { provide: Service, useValue: undefined },
    ]);

    const s = new Service;
    injector.set(Service, s);

    expect(injector.get(Service) === s).toBe(true);
});

test('set service in scope', () => {
    class Service {
    }

    @injectable
    class Connection {
        constructor(public service: Service) {
        }
    }

    class Request {
    }

    const injector = InjectorContext.forProviders([
        Service,
        { provide: Request, scope: 'tcp' },
        { provide: Connection, scope: 'tcp' }
    ]);

    const s1 = injector.get(Service);

    {
        const scope = injector.createChildScope('tcp');

        const c1 = new Connection(scope.get(Service));
        scope.set(Connection, c1);

        expect(scope.get(Connection) === c1).toBe(true);
        expect(scope.get(Connection) === c1).toBe(true);
        expect(scope.get(Connection).service === s1).toBe(true);
    }

    {
        const scope = injector.createChildScope('tcp');

        const c1 = new Connection(scope.get(Service));
        scope.set(Connection, c1);

        expect(scope.get(Connection) === c1).toBe(true);
        expect(scope.get(Connection) === c1).toBe(true);
        expect(scope.get(Connection).service === s1).toBe(true);
    }
});

Error.stackTraceLimit = 30;

test('global service from another module is available in sibling module', () => {
    class HttpRequest {
    }

    const httpModule = new InjectorModule([{ provide: HttpRequest, scope: 'http' }]);

    @injectable
    class Controller {
        constructor(public request: HttpRequest) {
        }
    }

    const apiModule = new InjectorModule([{ provide: Controller, scope: 'http' }]);

    const root = new InjectorModule();
    httpModule.forRoot().setParent(root);
    apiModule.setParent(root);

    const properties = root.getPreparedProviders({} as any);
    (root as any).handleExports({} as any);
    expect(properties.has(HttpRequest)).toBe(true);

    const injector = new InjectorContext(root);
    const scope = injector.createChildScope('http');

    const controller = scope.get(Controller, apiModule);
    expect(controller).toBeInstanceOf(Controller);
    expect(controller.request).toBeInstanceOf(HttpRequest);
});

test('string reference manually type', () => {
    class Service {
        add() {
        }
    }

    const root = new InjectorModule([{ provide: 'service', useClass: Service }]);
    const injector = new InjectorContext(root);

    const service = injector.get<Service>('service');
    service.add();
    expect(service).toBeInstanceOf(Service);
});

test('InjectorToken reference with interface', () => {
    interface Service {
        add(): void;
    }

    const serviceToken = new InjectorToken<Service>('service');

    const root = new InjectorModule([{
        provide: serviceToken, useClass: class {
            add() {
            }
        }
    }]);
    const injector = new InjectorContext(root);

    const service = injector.get(serviceToken);
    service.add();
});

test('injectorReference from other module', () => {
    class Service {
    }

    class Registry {
        services: any[] = [];

        register(service: any) {
            this.services.push(service);
        }
    }

    const module1 = new InjectorModule([Service]);
    const module2 = new InjectorModule([Registry]);

    module2.setupProvider(Registry).register(injectorReference(Service, module1));

    const root = new InjectorModule([]).addImport(module1, module2);
    const injector = new InjectorContext(root);

    {
        const registry = injector.get(Registry, module2);
        expect(registry.services).toHaveLength(1);
        expect(registry.services[0]).toBeInstanceOf(Service);
    }
});

test('inject its own module', () => {
    class Service {
        constructor(@inject(() => ApiModule) public module: any) {
        }
    }

    class ApiModule extends InjectorModule {

    }

    {
        const module1 = new ApiModule([Service]);
        const root = new InjectorModule([]).addImport(module1);
        const injector = new InjectorContext(root);

        const service = injector.get(Service, module1);
        expect(service.module).toBeInstanceOf(ApiModule);
    }

    {
        const module1 = new ApiModule([Service]).addExport(Service);
        const root = new InjectorModule([]).addImport(module1);
        const injector = new InjectorContext(root);

        const service = injector.get(Service, module1);
        expect(service.module).toBeInstanceOf(ApiModule);
    }
});
