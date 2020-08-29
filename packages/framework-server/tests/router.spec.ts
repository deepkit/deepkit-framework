import 'jest';
import 'reflect-metadata';
import {http, Injector} from '@super-hornet/framework-server-common';
import {Router} from '../src/router';
import {BenchSuite} from '@super-hornet/core';
import {HttpHandler} from '../src/http';

test('router', () => {
    class Controller {
        @http.GET()
        helloWorld() {}

        @http.GET(':name')
        hello(name: string) {}

        @http.GET('/user/:id/static')
        userStatic(id: string) {}
    }

    const router = Router.forControllers([Controller]);

    expect(router.resolve('GET', '/')).toEqual({controller: Controller, parameters: [], method: 'helloWorld'});
    expect(router.resolve('GET', '/peter')).toEqual({controller: Controller, parameters: ['peter'], method: 'hello'});
    expect(router.resolve('GET', '/user/1233/static')).toEqual({controller: Controller, parameters: ['1233'], method: 'userStatic'});

    const bench = new BenchSuite('Router perf');

    bench.add('/', () => {
        router.resolve('GET', '/');
    });

    bench.add('/peter', () => {
        router.resolve('GET', '/peter');
    });

    bench.add('/user/:id/static', () => {
        router.resolve('GET', '/user/21313/static');
    });

    bench.run();
});

test('router parameters', async () => {
    class Controller {
        @http.GET('/user/:name')
        string(name: string) {
            return name;
        }

        @http.GET('/user-id/:id')
        number(id: number) {
            return id;
        }

        @http.GET('/boolean/:yes')
        boolean(yes: boolean) {
            return yes;
        }
    }

    const httpHandler = new HttpHandler(Router.forControllers([Controller]));
    const injector = new Injector([Controller]);

    expect(await httpHandler.handleRequest(injector, 'GET', '/user/peter')).toBe('peter');
    expect(await httpHandler.handleRequest(injector, 'GET', '/user-id/123')).toBe(123);
    expect(await httpHandler.handleRequest(injector, 'GET', '/user-id/asd')).toBe(NaN);
    expect(await httpHandler.handleRequest(injector, 'GET', '/boolean/1')).toBe(true);
    expect(await httpHandler.handleRequest(injector, 'GET', '/boolean/false')).toBe(false);
});