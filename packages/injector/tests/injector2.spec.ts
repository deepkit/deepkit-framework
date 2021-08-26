import 'reflect-metadata';
import { expect, test } from '@jest/globals';
import { InjectorContext, InjectorModule } from '../src/injector';
import { injectable } from '../src/decorator';
import { getClassSchema } from '@deepkit/type';

test('basic', () => {
    class Service {}

    const module1 = new InjectorModule([Service]);

    const context = new InjectorContext(module1);
    const injector = context.getInjector(module1);
    expect(injector.get(Service)).toBeInstanceOf(Service);
    expect(injector.get(Service) === injector.get(Service)).toBe(true);
});

test('parent dependency', () => {
    class Router {}

    @injectable()
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
    expect(injector.offset).toBe(2);
    expect(injector.get(Controller)).toBeInstanceOf(Controller);
});

test('scoped provider', () => {
    class Service {}

    const module1 = new InjectorModule([{provide: Service, scope: 'http'}]);

    const context = new InjectorContext(module1);
    const injector = context.getInjector(module1);
    expect(() => injector.get(Service)).toThrow('not found');

    const scope = {name: 'http', instances: {}};

    expect(injector.get(Service, scope)).toBeInstanceOf(Service);
    expect(injector.get(Service, scope) === injector.get(Service, scope)).toBe(true);
});

test('scoped provider with dependency to unscoped', () => {
    class Service {}

    const module1 = new InjectorModule([{provide: Service, scope: 'http'}]);

    const context = new InjectorContext(module1);
    const injector = context.getInjector(module1);
    expect(() => injector.get(Service)).toThrow('not found');

    const scope = context.createChildScope('http');
    expect(scope.get(Service)).toBeInstanceOf(Service);
    expect(scope.get(Service) === scope.get(Service)).toBe(true);
});

test('reset', () => {
    class Service {}

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
    class Service {}

    const module1 = new InjectorModule([{provide: Service, scope: 'http'}]);
    const context = new InjectorContext(module1);

    const scope1 = context.createChildScope('http');
    const scope2 = context.createChildScope('http');

    expect(scope1.get(Service, module1)).toBeInstanceOf(Service);
    expect(scope1.get(Service, module1) === scope1.get(Service, module1)).toBe(true);

    expect(scope2.get(Service, module1)).toBeInstanceOf(Service);
    expect(scope2.get(Service, module1) === scope2.get(Service, module1)).toBe(true);

    expect(scope1.get(Service, module1) === scope2.get(Service, module1)).toBe(false);
});
