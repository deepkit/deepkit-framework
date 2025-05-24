import { expect, test } from '@jest/globals';
import { InjectorModule } from '../src/module.js';
import { Injector, InjectorContext } from '../src/injector.js';
import { provide } from '../src/provider.js';
import { Inject } from '@deepkit/core';
import { Logger } from '@deepkit/logger';

test('class + scope support', () => {
    class ServiceA {
    }

    class ServiceB {
        constructor(public serviceA: ServiceA) {
        }
    }

    class ScopedServiceC {
        constructor(public serviceA: ServiceA) {
        }
    }

    const providers = [
        { provide: ServiceA },
        { provide: ServiceB },
        { provide: ScopedServiceC, scope: 'rpc' },
    ];

    const module = new InjectorModule(providers);
    const injector = new InjectorContext(module);

    const a = injector.get(ServiceA);
    const b = injector.get(ServiceB);

    expect(a).toBeInstanceOf(ServiceA);
    expect(b).toBeInstanceOf(ServiceB);

    const scope1 = injector.createChildScope('rpc');
    const c1 = scope1.get(ScopedServiceC);
    expect(c1).toBeInstanceOf(ScopedServiceC);

    const resolvedScopedServiceC = injector.resolve(undefined, ScopedServiceC);
    const scope = injector.createChildScope('rpc');
    const c2 = resolvedScopedServiceC(scope.scope);
    expect(c2).toBeInstanceOf(ScopedServiceC);
});

test('type + scope support', () => {
    class ServiceA {
    }

    class ServiceB {
        constructor(public serviceA: ServiceA) {
        }
    }

    class ScopedServiceC {
        constructor(public scope: string) {
        }
    }

    const providers = [
        provide<ServiceA>(ServiceA),
        provide<ServiceB>(ServiceB),
        provide<ScopedServiceC>({ scope: 'rpc', useValue: new ScopedServiceC('rpc') }),
        provide<ScopedServiceC>({ scope: 'http', useValue: new ScopedServiceC('http') }),
    ];

    const module = new InjectorModule(providers);
    const injector = new InjectorContext(module);

    expect(injector.get(ServiceA)).toBeInstanceOf(ServiceA);
    expect(injector.get(ServiceB)).toBeInstanceOf(ServiceB);
    expect(injector.get<ServiceA>()).toBeInstanceOf(ServiceA);
    expect(injector.get<ServiceB>()).toBeInstanceOf(ServiceB);

    const scope1 = injector.createChildScope('rpc');
    const c1 = scope1.get(ScopedServiceC);
    expect(c1).toBeInstanceOf(ScopedServiceC);
    expect(c1.scope).toBe('rpc');

    const resolvedScopedServiceC = injector.resolve(undefined, ScopedServiceC);
    {
        const scope = injector.createChildScope('rpc');
        const c2 = resolvedScopedServiceC(scope.scope);
        expect(c2).toBeInstanceOf(ScopedServiceC);
        expect(c1.scope).toBe('rpc');
    }
    {
        const scope = injector.createChildScope('http');
        const c2 = resolvedScopedServiceC(scope.scope);
        expect(c2).toBeInstanceOf(ScopedServiceC);
        expect(c2.scope).toBe('http');
    }
});

test('exported provider', () => {
    class ModuleA extends InjectorModule {
    }

    class ModuleB extends InjectorModule {
    }

    class ServiceA {
    }

    class ServiceB {
        constructor(public serviceA: ServiceA) {
        }
    }

    const moduleB = new ModuleB([
        { provide: ServiceB, scope: 'rpc' },
    ]).addExport(ServiceB);

    const moduleA = new ModuleA([
        ServiceA,
        { provide: ServiceB, scope: 'rpc' },
    ]).addImport(moduleB);

    const injector = new InjectorContext(moduleA);
    const a = injector.get(ServiceA);
    expect(a).toBeInstanceOf(ServiceA);

    expect(() => injector.get(ServiceB)).toThrowError('Service \'ServiceB\' is known but is not available in scope global. Available in scopes: rpc');

    const scope = injector.createChildScope('rpc');
    const b1 = scope.get(ServiceB);
    expect(b1).toBeInstanceOf(ServiceB);

    const b2 = scope.get(ServiceB, moduleB);
    expect(b2).toBeInstanceOf(ServiceB);
});

test('optional forwarded to external module', () => {
    class ScopedService {
    }

    class Service {
        constructor(public scoped?: ScopedService) {
        }
    }

    const httpModule = new InjectorModule([
        { provide: ScopedService, scope: 'http', useValue: undefined },
        { provide: Service, scope: 'http', useFactory: (scoped?: ScopedService) => new Service(scoped) },
    ]).addExport(ScopedService, Service);

    const frameworkModule = new InjectorModule().addImport(httpModule).addExport(httpModule);
    const rootModule = new InjectorModule([]).addImport(frameworkModule);

    const injector = new InjectorContext(rootModule);
    const scoped = injector.createChildScope('http');

    const service = scoped.get(Service);
    expect(service.scoped).toBe(undefined);
});

test('scoped InjectorContext', () => {
    class RpcInjectorContext extends InjectorContext {
    }

    class HttpListener {
        constructor(public injector: InjectorContext) {
        }
    }

    const httpModule = new InjectorModule([
        HttpListener,
    ]);

    const frameworkModule = new InjectorModule([
        { provide: RpcInjectorContext, scope: 'rpc', useValue: undefined },
    ])
        .addImport(httpModule)
        .addExport(RpcInjectorContext, httpModule);

    const rootModule = new InjectorModule([
        { provide: InjectorContext, useFactory: () => injector },
    ]).addImport(frameworkModule);

    const injector = new InjectorContext(rootModule);

    const service = injector.get(HttpListener, httpModule);
    expect(service.injector.constructor).toBe(InjectorContext);
});

test('setter of unspecified scope', () => {
    class HttpRequest {
    }

    class FrameworkModule extends InjectorModule {
    }

    const frameworkModule = new FrameworkModule([
        { provide: HttpRequest, scope: 'http', useValue: undefined },
        { provide: HttpRequest, scope: 'rpc', useValue: undefined },
    ]).addExport(HttpRequest);

    const rootModule = new InjectorModule([]).addImport(frameworkModule);
    const injector = new InjectorContext(rootModule);
    const setter = injector.setter(undefined, HttpRequest);

    const httpRequest = new HttpRequest();
    const scope = injector.createChildScope('http');
    setter(httpRequest, scope.scope);

    expect(scope.get(HttpRequest)).toBe(httpRequest);
});

test('inject module', () => {
    class HttpRequest {
        constructor(public module: InjectorModule) {
        }
    }

    class HttpListener {
        constructor(public module: InjectorModule) {
        }
    }

    class HttpListener2 {
        constructor(public injector: Injector) {
        }
    }

    class HttpModule extends InjectorModule {
    }

    class FrameworkModule extends InjectorModule {
    }

    const httpModule = new HttpModule([
        HttpListener,
        HttpListener2,
    ]).addExport(HttpListener, HttpListener2);

    const frameworkModule = new FrameworkModule([
        { provide: HttpRequest, scope: 'http' },
    ]).addImport(httpModule).addExport(httpModule, HttpRequest);

    const rootModule = new InjectorModule([]).addImport(frameworkModule);
    const injector = new InjectorContext(rootModule);

    const httpListener = injector.get(HttpListener);
    expect(httpListener.module == httpModule).toBe(true);

    const httpListener2 = injector.get(HttpListener2);
    expect(httpListener2.injector == httpModule.injector).toBe(true);

    const scope = injector.createChildScope('http');
    const httpRequest = scope.get(HttpRequest);
    expect(httpRequest.module == frameworkModule).toBe(true);
});

test('constructor properties only handled once', () => {
    let created = 0;

    type InjectServiceB = Inject<any, 'scoped-logger'>;

    class ServiceA {
        constructor(public serviceB: InjectServiceB) {
        }
    }

    const module = new InjectorModule([
        { provide: ServiceA },
        Logger,
        {
            provide: 'scoped-logger', transient: true, useFactory() {
                created++;
                return {};
            },
        },
    ]);

    const injector = new InjectorContext(module);
    const a1 = injector.get(ServiceA);
    expect(created).toBe(1);
});
