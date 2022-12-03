import { expect, test } from '@jest/globals';
import { HttpRouter } from '../src/router';
import { HttpRouteFilter, HttpRouterFilterResolver } from '../src/filter';
import { http } from '../src/decorator';
import { createModule } from '@deepkit/app';

test('filter by controller', async () => {
    class ControllerA {
        @http.GET('a')
        route() {
        }
    }

    class ControllerB {
        @http.GET('b')
        route() {
        }
    }

    const resolver = new HttpRouterFilterResolver(HttpRouter.forControllers([
        ControllerA, ControllerB
    ]));

    class NonExisting {
    }

    expect(resolver.resolve(new HttpRouteFilter().model).length).toBe(2);
    expect(resolver.resolve(new HttpRouteFilter().excludeControllers(ControllerA).model).length).toBe(1);
    expect(resolver.resolve(new HttpRouteFilter().excludeControllers(ControllerA, ControllerB).model).length).toBe(0);
    expect(resolver.resolve(new HttpRouteFilter().forControllers(ControllerA).model).length).toBe(1);
    expect(resolver.resolve(new HttpRouteFilter().forControllers(ControllerB).model).length).toBe(1);
    expect(resolver.resolve(new HttpRouteFilter().forControllers(NonExisting).model).length).toBe(0);
});

test('filter by route names', async () => {
    class ControllerA {
        @http.GET('a').name('a')
        route() {
        }
    }

    class ControllerB {
        @http.GET('b').name('b')
        route() {
        }

        @http.GET('c')
        unnamed() {
        }
    }

    const resolver = new HttpRouterFilterResolver(HttpRouter.forControllers([
        ControllerA, ControllerB
    ]));

    expect(resolver.resolve(new HttpRouteFilter().model).length).toBe(3);
    expect(resolver.resolve(new HttpRouteFilter().forRouteNames('a').model).length).toBe(1);
    expect(resolver.resolve(new HttpRouteFilter().excludeRouteNames('a').model).length).toBe(2);
    expect(resolver.resolve(new HttpRouteFilter().excludeRouteNames('a', 'b').model).length).toBe(1);
    expect(resolver.resolve(new HttpRouteFilter().excludeRouteNames('a', 'b', 'c').model).length).toBe(1); //name c doesnt exist
    expect(resolver.resolve(new HttpRouteFilter().forRouteNames('b').model).length).toBe(1);
    expect(resolver.resolve(new HttpRouteFilter().forRouteNames('b', 'a').model).length).toBe(2);
});

test('filter by route names and controller', async () => {
    class ControllerA {
        @http.GET('a').name('a')
        route() {
        }
    }

    class ControllerB {
        @http.GET('a').name('a')
        route() {
        }

        @http.GET('b')
        unnamed() {
        }
    }

    const resolver = new HttpRouterFilterResolver(HttpRouter.forControllers([
        ControllerA, ControllerB
    ]));

    expect(resolver.resolve(new HttpRouteFilter().model).length).toBe(3);
    expect(resolver.resolve(new HttpRouteFilter().forRouteNames('a').model).length).toBe(2);
    expect(resolver.resolve(new HttpRouteFilter().forControllers(ControllerA).forRouteNames('a').model).length).toBe(1);
});

test('filter by groups', async () => {
    class ControllerA {
        @http.GET('a').group('a')
        route() {
        }
    }

    class ControllerB {
        @http.GET('a').group('b')
        route() {
        }

        @http.GET('b')
        unnamed() {
        }
    }

    const resolver = new HttpRouterFilterResolver(HttpRouter.forControllers([
        ControllerA, ControllerB
    ]));

    expect(resolver.resolve(new HttpRouteFilter().model).length).toBe(3);
    expect(resolver.resolve(new HttpRouteFilter().forRoutes({group: 'a'}).model).length).toBe(1);
    expect(resolver.resolve(new HttpRouteFilter().forRoutes({group: 'b'}).model).length).toBe(1);
    expect(resolver.resolve(new HttpRouteFilter().forRoutes({group: 'c'}).model).length).toBe(0);

    expect(resolver.resolve(new HttpRouteFilter().excludeRoutes({group: 'a'}).model).length).toBe(2);
    expect(resolver.resolve(new HttpRouteFilter().excludeRoutes({group: 'b'}).model).length).toBe(2);
    expect(resolver.resolve(new HttpRouteFilter().excludeRoutes({group: 'c'}).model).length).toBe(3);
});

test('filter by modules', async () => {
    class ControllerA {
        @http.GET('a')
        route() {
        }
    }

    class ControllerB {
        @http.GET('a')
        route() {
        }

        @http.GET('b')
        unnamed() {
        }
    }

    class ControllerC {
        @http.GET('c')
        route() {
        }
    }

    class ModuleA extends createModule({}) {
    }

    class ModuleB extends createModule({}) {
    }

    const moduleA = new ModuleA();
    const moduleB = new ModuleB();
    expect(moduleA instanceof ModuleA).toBe(true);
    expect(moduleA instanceof ModuleB).toBe(false);

    expect(moduleB instanceof ModuleA).toBe(false);
    expect(moduleB instanceof ModuleB).toBe(true);

    const resolver = new HttpRouterFilterResolver(HttpRouter.forControllers([
        { controller: ControllerA, module: moduleA }, { controller: ControllerB, module: moduleA },
        { controller: ControllerC, module: moduleB },
    ]));

    {
        expect(resolver.resolve(new HttpRouteFilter().model).length).toBe(4);
        expect(resolver.resolve(new HttpRouteFilter().forModules(moduleA).model).length).toBe(3);
        expect(resolver.resolve(new HttpRouteFilter().excludeModules(moduleA).model).length).toBe(1);
        expect(resolver.resolve(new HttpRouteFilter().forModules(moduleB).model).length).toBe(1);
        expect(resolver.resolve(new HttpRouteFilter().excludeModules(moduleB).model).length).toBe(3);
        expect(resolver.resolve(new HttpRouteFilter().forModules(moduleA, moduleB).model).length).toBe(4);
        expect(resolver.resolve(new HttpRouteFilter().forModules(moduleA, moduleB).excludeModules(moduleB).model).length).toBe(3);
    }
    {
        expect(resolver.resolve(new HttpRouteFilter().model).length).toBe(4);
        expect(resolver.resolve(new HttpRouteFilter().excludeModuleClasses(ModuleA).model).length).toBe(1);
        expect(resolver.resolve(new HttpRouteFilter().excludeModuleClasses(ModuleB).model).length).toBe(3);
        expect(resolver.resolve(new HttpRouteFilter().forModuleClasses(ModuleA).model).length).toBe(3);
        expect(resolver.resolve(new HttpRouteFilter().forModuleClasses(ModuleB).model).length).toBe(1);
        expect(resolver.resolve(new HttpRouteFilter().forModuleClasses(ModuleA, ModuleB).model).length).toBe(4);
    }
    {
        expect(resolver.resolve(new HttpRouteFilter().forRoutes({path: '/b'}, {path: '/c'}).model).length).toBe(2);
    }
});
