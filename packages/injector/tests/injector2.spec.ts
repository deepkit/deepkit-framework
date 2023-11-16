import { expect, test } from '@jest/globals';
import { InjectorContext, injectorReference } from '../src/injector.js';
import { provide, Tag } from '../src/provider.js';
import { InjectorModule } from '../src/module.js';
import { InlineRuntimeType, ReflectionKind, Type, typeOf } from '@deepkit/type';
import { Inject, InjectMeta, nominalCompatibility } from '../src/types.js';

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

    class Controller {
        constructor(public router: Router) {
        }
    }

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

    class Service {
        constructor(public helper: ServiceHelper) {
        }
    }

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

    class Controller {
        constructor(public router?: Router) {
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

    class Service {
        constructor(public encapsulated: Encapsulated) {
        }
    }

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
    class Config {
        listen: string = '';
    }

    class Service {
        constructor(public listen: Config['listen']) {
        }
    }

    class MyModule extends InjectorModule {
    }

    const root = new InjectorModule([]);

    const module = new MyModule([
        Service
    ], root, { listen: 'localhost' }).forRoot().setConfigDefinition(Config);

    const injector = new InjectorContext(root);

    const service = injector.get(Service, module);

    expect(service).toBeInstanceOf(Service);
    expect(service.listen).toBe('localhost');
});

test('setup provider by class', () => {
    class Service {
        list: any[] = [];

        add(item: any) {
            this.list.push(item);
        }
    }

    const root = new InjectorModule([Service]);

    root.setupProvider<Service>().add('a');
    root.setupProvider<Service>().add('b');

    const injector = new InjectorContext(root);
    const service = injector.get(Service);

    expect(service.list).toEqual(['a', 'b']);
});

test('setup provider by interface 1', () => {
    class Service {
        list: any[] = [];

        add(item: any) {
            this.list.push(item);
        }
    }

    interface ServiceInterface {
        add(item: any): any;
    }

    const root = new InjectorModule([Service]);

    root.setupProvider<ServiceInterface>().add('a');
    root.setupProvider<ServiceInterface>().add('b');

    const injector = new InjectorContext(root);
    const service = injector.get(Service);

    expect(service.list).toEqual(['a', 'b']);
});

test('setup provider by interface 2', () => {
    class Service {
        list: any[] = [];

        add(item: any) {
            this.list.push(item);
        }
    }

    interface ServiceInterface {
        list: any[];

        add(item: any): any;
    }

    const root = new InjectorModule([provide<ServiceInterface>(Service)]);

    root.setupProvider<ServiceInterface>().add('a');
    root.setupProvider<ServiceInterface>().add('b');

    const injector = new InjectorContext(root);
    const service = injector.get<ServiceInterface>();

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

    module.setupProvider<Service>().add('a');
    module.setupProvider<Service>().add('b');

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

    module.setupProvider<Service>().add('a');
    module.setupProvider(0, Service).add('b');

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

    module.setupGlobalProvider<Service>().add('a');
    module.setupGlobalProvider<Service>().add('b');

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

test('global service from another module is available in sibling module', () => {
    class HttpRequest {
    }

    const httpModule = new InjectorModule([{ provide: HttpRequest, scope: 'http' }]);

    class Controller {
        constructor(public request: HttpRequest) {
        }
    }

    const apiModule = new InjectorModule([{ provide: Controller, scope: 'http' }]);

    const root = new InjectorModule();
    httpModule.forRoot().setParent(root);
    apiModule.setParent(root);

    // const properties = root.getPreparedProviders({} as any);
    // (root as any).handleExports({} as any);
    // expect(properties.has(HttpRequest)).toBe(true);

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

test('provide() with provider', () => {
    interface Redis {
        get(key: string): any;
    }

    class RedisImplementation implements Redis {
        get(key: string): any {
            return true;
        }
    }

    class Service {
        constructor(public redis: Redis) {
        }
    }

    const root = new InjectorModule([
        Service,
        provide<Redis>({ useValue: new RedisImplementation })
    ]);

    const injector = new InjectorContext(root);

    const service = injector.get(Service);
    expect(service.redis.get('abc')).toBe(true);
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

    module2.setupProvider<Registry>().register(injectorReference(Service, module1));

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
        constructor(public module: ApiModule) {
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

test('provider with function as token', () => {
    function MyOldClass() {
        return 'hi';
    }

    //in es5 code, classes are actual functions and not detectable as class
    const root = new InjectorModule([{ provide: MyOldClass as any, useValue: MyOldClass }]);
    const injector = new InjectorContext(root);

    const fn = injector.get(MyOldClass);

    expect(fn()).toBe('hi');
});


test('instantiatedCount singleton', () => {
    class Service {
    }

    class Registry {
    }

    const module1 = new InjectorModule([Service]);
    const module2 = new InjectorModule([Registry]).addExport(Registry);

    const root = new InjectorModule([]).addImport(module1, module2);
    const injector = new InjectorContext(root);

    {
        expect(injector.instantiationCount(Service, module1)).toBe(0);
        injector.get(Service, module1);
        expect(injector.instantiationCount(Service, module1)).toBe(1);
        injector.get(Service, module1);
        expect(injector.instantiationCount(Service, module1)).toBe(1);
    }

    {
        expect(injector.instantiationCount(Registry, module2)).toBe(0);
        injector.get(Registry, module2);
        expect(injector.instantiationCount(Registry, module2)).toBe(1);
        injector.get(Registry, module2);
        expect(injector.instantiationCount(Registry, module2)).toBe(1);
        injector.createChildScope('http').get(Registry, module2);
        expect(injector.instantiationCount(Registry, module2)).toBe(1);
    }
});

test('instantiatedCount scope', () => {
    class Request {
    }

    const module1 = new InjectorModule([{ provide: Request, scope: 'http' }]).addExport(Request);

    const root = new InjectorModule([{ provide: Request, scope: 'rpc' }]).addImport(module1);
    const injector = new InjectorContext(root);
    expect(injector.instantiationCount(Request, module1)).toBe(0);

    {
        expect(injector.createChildScope('http').instantiationCount(Request, module1, 'http')).toBe(0);
        injector.createChildScope('http').get(Request, module1);
        expect(injector.instantiationCount(Request, module1)).toBe(0);

        expect(injector.createChildScope('http').instantiationCount(Request, module1, 'http')).toBe(1);
        injector.createChildScope('http').get(Request, module1);
        expect(injector.createChildScope('http').instantiationCount(Request, module1, 'http')).toBe(2);
        injector.createChildScope('rpc').get(Request);
        expect(injector.instantiationCount(Request, undefined, 'http')).toBe(2);
        expect(injector.instantiationCount(Request, undefined, 'rpc')).toBe(1);
    }
});


test('configuration work in deeply nested imports with overridden service', () => {
    class BrokerConfig {
        listen!: string;
    }

    class BrokerServer {
        constructor(public listen: BrokerConfig['listen']) {
        }
    }

    class BrokerModule extends InjectorModule {
    }

    class ApplicationServer {
        constructor(public broker: BrokerServer) {
        }
    }

    class FrameworkModule extends InjectorModule {
    }

    const brokerModule = new BrokerModule([BrokerServer], undefined, { listen: '0.0.0.0' }).addExport(BrokerServer).setConfigDefinition(BrokerConfig);

    const frameworkModule = new FrameworkModule([ApplicationServer]).addImport(brokerModule).addExport(BrokerModule, ApplicationServer);

    class Broker {
        constructor(public server: BrokerServer) {
        }
    }

    class BrokerMemoryServer extends BrokerServer {
    }

    const root = new InjectorModule([
        { provide: BrokerServer, useClass: BrokerMemoryServer }
    ]).addImport(frameworkModule);

    const injector = new InjectorContext(root);
    const applicationServer = injector.get(ApplicationServer);
    expect(applicationServer.broker.listen).toBe('0.0.0.0');
    expect(applicationServer.broker).toBeInstanceOf(BrokerMemoryServer);

    const brokerServer = injector.get(BrokerServer);
    expect(brokerServer).toBeInstanceOf(BrokerMemoryServer);
    expect(brokerServer.listen).toBe('0.0.0.0');
});


test('exported scoped can be replaced for another scope', () => {
    class HttpRequest {
    }

    class HttpModule extends InjectorModule {
    }

    const httpModule = new HttpModule([{ provide: HttpRequest, scope: 'http' }]).addExport(HttpRequest);

    class FrameworkModule extends InjectorModule {
    }

    const frameworkModule = new FrameworkModule([{ provide: HttpRequest, scope: 'rpc' }]).addImport(httpModule).addExport(HttpModule, HttpRequest);

    const root = new InjectorModule().addImport(frameworkModule);

    const injector = new InjectorContext(root);
    expect(() => injector.get(HttpRequest)).toThrow('not found');

    const scopeHttp = injector.createChildScope('http');
    const httpRequest1 = scopeHttp.get(HttpRequest);
    expect(httpRequest1).toBeInstanceOf(HttpRequest);

    const scopeRpc = injector.createChildScope('rpc');
    const httpRequest2 = scopeRpc.get(HttpRequest);
    expect(httpRequest2).toBeInstanceOf(HttpRequest);
    expect(httpRequest2 !== httpRequest1).toBe(true);
});

test('consume config from imported modules', () => {
    class ModuleConfig {
        host: string = '0.0.0.0';
    }

    class ModuleService {
        constructor(public host: ModuleConfig['host']) {
        }
    }

    const moduleModule = new InjectorModule([ModuleService]).setConfigDefinition(ModuleConfig);

    class OverriddenService extends ModuleService {
    }

    const root = new InjectorModule([OverriddenService]).addImport(moduleModule);

    const injector = new InjectorContext(root);
    const service = injector.get(OverriddenService);
    expect(service.host).toBe('0.0.0.0');
});

test('injector.get by type', () => {
    interface LoggerInterface {
        log(): boolean;
    }

    class Logger implements LoggerInterface {
        log(): boolean {
            return true;
        }
    }

    class Controller {
        constructor(public logger: LoggerInterface) {
        }
    }

    const root = new InjectorModule([Controller, Logger]);

    const injector = new InjectorContext(root);
    const service = injector.get<LoggerInterface>();
    expect(service).toBeInstanceOf(Logger);
    const controller = injector.get<Controller>();
    expect(controller.logger).toBeInstanceOf(Logger);
});

test('exported token from interface', () => {
    interface LoggerInterface {
        log(): boolean;
    }

    class Logger {
        log(): boolean {
            return true;
        }
    }

    class ModuleController {
        constructor(public logger: LoggerInterface) {
        }
    }

    class Controller {
        constructor(public logger: LoggerInterface) {
        }
    }

    {
        const module = new InjectorModule([provide<LoggerInterface>(Logger), ModuleController]).addExport(typeOf<LoggerInterface>(), ModuleController);
        const root = new InjectorModule([Controller]).addImport(module);

        const injector = new InjectorContext(root);
        const service = injector.get<LoggerInterface>();
        expect(service).toBeInstanceOf(Logger);

        const controller = injector.get<Controller>();
        expect(controller.logger).toBeInstanceOf(Logger);

        const moduleController = injector.get<ModuleController>();
        expect(moduleController.logger).toBeInstanceOf(Logger);
    }

    {
        class OverwrittenLogger implements LoggerInterface {
            log(): boolean {
                return true;
            }
        }

        const module = new InjectorModule([provide<LoggerInterface>(Logger), ModuleController]).addExport(typeOf<LoggerInterface>(), ModuleController);
        const root = new InjectorModule([Controller, OverwrittenLogger]).addImport(module);

        const injector = new InjectorContext(root);
        const service = injector.get<LoggerInterface>();
        expect(service).toBeInstanceOf(OverwrittenLogger);

        const controller = injector.get<Controller>();
        expect(controller.logger).toBeInstanceOf(OverwrittenLogger);

        const moduleController = injector.get<ModuleController>();
        expect(moduleController.logger).toBeInstanceOf(OverwrittenLogger);
    }
});


test('2 level deep module keeps its instances encapsulated', () => {
    class Logger {
    }


    class QualificationRepository {
    }

    class QualificationService {
        constructor(public qualificationRepo: QualificationRepository, public logger: Logger) {
        }
    }

    class QualificationModule extends InjectorModule {
        constructor() {
            super();
            this.addProvider(QualificationRepository, QualificationService);
            this.addExport(QualificationService);
        }
    }

    class EmergencyService {
        constructor(public qualificationService: QualificationService) {
        }
    }

    class EmergencyModule extends InjectorModule {
    }

    const emergencyModule = new EmergencyModule([EmergencyService]).addImport(new QualificationModule).addExport(EmergencyService);

    class AnotherModule extends InjectorModule {
    }

    class AnotherService {
        constructor(public qualificationService: QualificationService) {
        }
    }

    const anotherModule = new AnotherModule([AnotherService]).addImport(new QualificationModule);

    /**
     * Module hierarchy is like
     * app
     *    - EmergencyModule
     *        - QualificationModule
     *    - AnotherModule
     *        - QualificationModule
     *
     *  Each sub-module of app has its own QualificationModule and thus its instances are scoped and not moved to root app.
     *
     */
    const app = new InjectorModule([Logger]).addImport(emergencyModule, anotherModule);

    const injector = new InjectorContext(app);
    const emergencyService = injector.get(EmergencyService, emergencyModule);
    expect(emergencyService).toBeInstanceOf(EmergencyService);
    expect(emergencyService === injector.get(EmergencyService)); //it's moved to the root module
    expect(emergencyService.qualificationService).toBeInstanceOf(QualificationService);
    expect(emergencyService.qualificationService.qualificationRepo).toBeInstanceOf(QualificationRepository);
    expect(emergencyService.qualificationService.logger).toBeInstanceOf(Logger);

    const emergencyService2 = injector.get(AnotherService, anotherModule);
    expect(emergencyService.qualificationService !== emergencyService2.qualificationService).toBe(true);
});

test('encapsulated module services cannot be used', () => {
    //encapsulated service
    class Module1Service {
    }

    class MyModule1 extends InjectorModule {
    }

    const myModule1 = new MyModule1([Module1Service]);

    class Module2Service {
        //this should not be possible, even if we import MyModule1
        constructor(public module1: Module1Service) {
        }
    }

    class MyModule2 extends InjectorModule {
    }

    const myModule2 = new MyModule2([Module2Service]).addImport(myModule1);

    const app = new InjectorModule([]).addImport(myModule2);
    const injector = new InjectorContext(app);
    expect(() => injector.get(Module2Service, myModule2)).toThrow(`Undefined dependency "module1: Module1Service" of Module2Service(?)`);
});

test('external pseudo class without annotation', () => {
    const Stripe = eval('(function Stripe() {this.isStripe = true;})');

    class MyService {
        constructor(public stripe: typeof Stripe) {
        }
    }

    const app = new InjectorModule([
        {
            provide: Stripe, useFactory() {
                return new Stripe;
            }
        },
        MyService
    ]);
    const injector = new InjectorContext(app);

    const service = injector.get<MyService>();
    expect(service.stripe).toBeInstanceOf(Stripe);
    expect(service.stripe.isStripe).toBe(true);
});

test('external class without annotation', () => {
    const Stripe = eval('(class Stripe { constructor() {this.isStripe = true}})');

    class MyService {
        constructor(public stripe: typeof Stripe) {
        }
    }

    const app = new InjectorModule([
        {
            provide: Stripe, useFactory() {
                return new Stripe;
            }
        },
        MyService
    ]);
    const injector = new InjectorContext(app);

    const service = injector.get<MyService>();
    expect(service.stripe).toBeInstanceOf(Stripe);
    expect(service.stripe.isStripe).toBe(true);
});

test('inject via string', () => {
    const symbol1 = 'string1';
    const symbol2 = 'string2';

    class MyService {
        constructor(
            public service1: Inject<any, typeof symbol1>,
            public service2: Inject<any, typeof symbol2>,
        ) {
        }
    }

    const app = new InjectorModule([
        {
            provide: symbol1, useFactory() {
                return { value: 1 };
            }
        },
        {
            provide: symbol2, useFactory() {
                return { value: 2 };
            }
        },
        MyService
    ]);
    const injector = new InjectorContext(app);

    const service = injector.get<MyService>();
    expect(service.service1.value).toBe(1);
    expect(service.service2.value).toBe(2);
});


test('inject via symbols', () => {
    const symbol1 = Symbol();
    const symbol2 = Symbol();

    class MyService {
        constructor(
            public service1: Inject<any, typeof symbol1>,
            public service2: Inject<any, typeof symbol2>,
        ) {
        }
    }

    const app = new InjectorModule([
        {
            provide: symbol1, useFactory() {
                return { value: 1 };
            }
        },
        {
            provide: symbol2, useFactory() {
                return { value: 2 };
            }
        },
        MyService
    ]);
    const injector = new InjectorContext(app);

    const service = injector.get<MyService>();
    expect(service.service1.value).toBe(1);
    expect(service.service2.value).toBe(2);
});

test('class inheritance', () => {
    class A {
    }

    class B {
        constructor(public a: A) {
        }
    }

    class C extends B {
    }

    const app = new InjectorModule([A, C]);
    const injector = new InjectorContext(app);

    const c = injector.get(C);
    expect(c).toBeInstanceOf(C);
    expect(c).toBeInstanceOf(B);
    expect(c.a).toBeInstanceOf(A);
});

test('config from a module is available in child modules', () => {
    class Config {
        db: string = 'localhost';
    }

    const rootModule = new InjectorModule().setConfigDefinition(Config);

    class Service {
        constructor(public config: Config) {
        }
    }

    const childModule = new InjectorModule([Service]).setParent(rootModule);

    const injector = new InjectorContext(rootModule);

    const service = injector.get(Service, childModule);
    expect(service.config.db).toBe('localhost');
});

test('type provider', () => {
    const uniqueType: Type = { kind: ReflectionKind.literal, literal: 'uniqueType' };

    class Service {
        constructor(public value: any & InjectMeta<InlineRuntimeType<typeof uniqueType>>) {
        }
    }

    const rootModule = new InjectorModule().addProvider(Service, { provide: uniqueType, useValue: '123' });
    const injector = new InjectorContext(rootModule);
    const service = injector.get(Service);
    expect(service.value).toBe('123');
});

test('exported type provider', () => {
    const uniqueType: Type = { kind: ReflectionKind.literal, literal: 'uniqueType' };

    class Service {
        constructor(public value: any & InjectMeta<InlineRuntimeType<typeof uniqueType>>) {
        }
    }

    const childModule = new InjectorModule([]).addProvider({ provide: uniqueType, useValue: '123' }).addExport(uniqueType);
    const rootModule = new InjectorModule().addProvider(Service).addImport(childModule);

    const injector = new InjectorContext(rootModule);
    const service = injector.get(Service);
    expect(service.value).toBe('123');
});

test('split configuration into multiple types', () => {
    class DatabaseConfig {
        host: string = 'localhost';
    }

    class Config {
        db: DatabaseConfig = new DatabaseConfig();
    }

    class Service {
        constructor(public dbConfig: DatabaseConfig) {
        }
    }

    const rootModule = new InjectorModule([Service]).setConfigDefinition(Config);

    const injector = new InjectorContext(rootModule);
    const service = injector.get(Service);
    expect(service.dbConfig.host).toBe('localhost');
});

test('empty interface provider', () => {
    interface Test {
    }

    const TEST = {};

    const Test = provide<Test>({ useValue: TEST });
    const rootModule = new InjectorModule([Test]);
    const injector = new InjectorContext(rootModule);
    const service = injector.get<Test>();
    expect(service).toBe(TEST);
});

test('export provider', () => {
    interface Test {
    }

    const TEST = {};

    const Test = provide<Test>({ useValue: TEST });
    const module = new InjectorModule([Test]).addExport(Test);

    const rootModule = new InjectorModule().addImport(module);
    const injector = new InjectorContext(rootModule);
    const service = injector.get<Test>();
    expect(service).toBe(TEST);
});

test('deep config index 2 level via class', () => {
    class DB {
        url: string = 'localhost';
    }

    class Config {
        db: DB = new DB;
    }

    class Database {
        constructor(public url: Config['db']['url']) {
        }
    }

    const rootModule = new InjectorModule([Database]).setConfigDefinition(Config);
    const injector = new InjectorContext(rootModule);
    const database = injector.get(Database);
    expect(database.url).toBe('localhost');
});

test('deep config index 2 level object literal', () => {
    class Config {
        db: { url: string } = { url: 'localhost' };
    }

    class Database {
        constructor(public url: Config['db']['url']) {
        }
    }

    const rootModule = new InjectorModule([Database]).setConfigDefinition(Config);
    const injector = new InjectorContext(rootModule);
    const database = injector.get(Database);
    expect(database.url).toBe('localhost');
});

test('deep config index direct sub class access', () => {
    class DB {
        url: string = 'localhost';
        options: { timeout: number } = { timeout: 30 };
    }

    class Config {
        db: DB = new DB;
    }

    class Database {
        constructor(public url: DB['url']) {
        }
    }

    const rootModule = new InjectorModule([Database]).setConfigDefinition(Config);
    const injector = new InjectorContext(rootModule);
    const database = injector.get(Database);
    expect(database.url).toBe('localhost');
});
