import { expect, test } from '@jest/globals';
import { InjectorModule } from '../src/module.js';
import { InjectorContext } from '../src/injector.js';
import { provide } from '../src/provider.js';
import { assertType, findMember, ReflectionKind, typeOf } from '@deepkit/type';

test('nominal alias types are unique', () => {
    class Service {
        constructor(public name: string) {
        }
    }

    type A = Service;
    type B = Service;

    class Manager {
        constructor(public service: A) {
        }
    }

    const t1 = typeOf<Manager>();
    assertType(t1, ReflectionKind.class);
    const ta = typeOf<A>();
    const tb = typeOf<B>();

    const prop = findMember('service', t1.types);
    assertType(prop, ReflectionKind.property);
    expect(prop.type.id).toBe(ta.id);
    expect(ta.id).not.toBe(tb.id);

    const rootModule = new InjectorModule([
        Manager,
        provide<A>({ useValue: new Service('A') }),
        provide<B>({ useValue: new Service('B') }),
    ]);
    const injector = new InjectorContext(rootModule);
    expect(injector.get<A>().name).toBe('A');
    expect(injector.get<B>().name).toBe('B');

    const database = injector.get(Manager);
    expect(database.service.name).toBe('A');

});

test('child implementation not override better match', () => {
    class MyService {
    }

    class ScopedMyService extends MyService {
    }

    class User {
        constructor(public service: MyService) {
        }
    }

    const rootModule = new InjectorModule([
        User,
        { provide: MyService },
        { provide: ScopedMyService },
    ]);
    const injector = new InjectorContext(rootModule);

    const s1 = injector.get(MyService);
    expect(s1.constructor).toBe(MyService);
    const s2 = injector.get(ScopedMyService);
    expect(s2.constructor).toBe(ScopedMyService);

    const user = injector.get(User);
    expect(user.service).not.toBeInstanceOf(ScopedMyService);
});


test('child implementation in different scope', () => {
    class MyService {
    }

    class ScopedMyService extends MyService {
    }

    class User {
        constructor(public service: MyService) {
        }
    }

    const rootModule = new InjectorModule([
        User,
        { provide: MyService },
        { provide: ScopedMyService, scope: 'rpc' },
    ]);
    const injector = new InjectorContext(rootModule);

    const user = injector.get(User);
    expect(user.service.constructor).toBe(MyService);
});

test('child implementation from imported module encapsulated', () => {
    class User {
        constructor(public context: InjectorContext) {
        }
    }

    class RpcInjectorContext extends InjectorContext {
    }

    let injectorContext: InjectorContext | undefined;

    const module = new InjectorModule([
        User,
        // => since User is not exported, it should not access overrides from outside, thus it should be RpcInjectorContext
        { provide: RpcInjectorContext },
    ]);

    const rootModule = new InjectorModule([
        { provide: InjectorContext, useFactory: () => injectorContext! },
    ]).addImport(module);
    injectorContext = new InjectorContext(rootModule);

    const user = injectorContext.get(User, module);
    expect(user.context.constructor).toBe(RpcInjectorContext);
});

test('child implementation from imported module partly exported', () => {
    class User {
        constructor(public context: InjectorContext) {
        }
    }

    class RpcInjectorContext extends InjectorContext {
    }

    let injectorContext: InjectorContext | undefined;

    const module = new InjectorModule([
        User,
        // => since User is exported, it should access overrides from outside, thus it should be InjectorContext
        { provide: RpcInjectorContext },
    ]).addExport(User);

    const rootModule = new InjectorModule([
        { provide: InjectorContext, useFactory: () => injectorContext! },
    ]).addImport(module);
    injectorContext = new InjectorContext(rootModule);

    const user = injectorContext.get(User);
    expect(user.context.constructor).toBe(InjectorContext);
});

test('child implementation from imported module exported', () => {
    class User {
        constructor(public context: InjectorContext) {
        }
    }

    class RpcInjectorContext extends InjectorContext {
    }

    let injectorContext: InjectorContext | undefined;

    const module = new InjectorModule([
        User,
        // => since User is exported, it should access overrides from outside, thus it should be InjectorContext
        { provide: RpcInjectorContext },
    ]).addExport(User, RpcInjectorContext);

    const rootModule = new InjectorModule([
        { provide: InjectorContext, useFactory: () => injectorContext! },
    ]).addImport(module);
    injectorContext = new InjectorContext(rootModule);

    const user = injectorContext.get(User);
    expect(user.context.constructor).toBe(InjectorContext);
});

test('nominal alias of arbitrary type', () => {
    type SomeType = any;
    type SomeOtherType = any;

    class MyService {
        constructor(public type: SomeType) {
        }
    }

    class MyService2 {
        constructor(public type: SomeOtherType) {
        }
    }

    const someType = typeOf<SomeType>();
    const someOtherType = typeOf<SomeOtherType>();

    expect(someType.id).toBeGreaterThan(0);
    expect(someOtherType.id).toBeGreaterThan(0);
    expect(someOtherType.id).not.toBe(someType.id);

    const rootModule = new InjectorModule([
        MyService,
        MyService2,
        provide<SomeType>({ useValue: 'foo' }),
        provide<SomeOtherType>({ useValue: 'bar' }),
    ]);

    const injector = new InjectorContext(rootModule);
    const myService = injector.get(MyService);
    expect(myService.type).toBe('foo');

    const myService2 = injector.get(MyService2);
    expect(myService2.type).toBe('bar');
});

