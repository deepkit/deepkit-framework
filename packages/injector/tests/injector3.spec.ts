import { expect, test } from '@jest/globals';
import { InjectorModule } from '../src/module.js';
import { InjectorContext } from '../src/injector.js';
import { provide } from '../src/provider.js';

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

    const resolvedScopedServiceC = injector.resolver(undefined, ScopedServiceC);
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

    const resolvedScopedServiceC = injector.resolver(undefined, ScopedServiceC);
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
