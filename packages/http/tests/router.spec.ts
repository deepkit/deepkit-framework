import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { dotToUrlPath, RouteParameterResolverContext, RouteParameterResolverTag, Router } from '../src/router';
import { http, httpClass } from '../src/decorator';
import { t } from '@deepkit/type';
import { HttpListener, JSONResponse } from '../src/http';
import { HttpKernel } from '../src/kernel';
import { EventDispatcher } from '@deepkit/event';
import { InjectorContext, ProviderWithScope, Tag } from '@deepkit/injector';
import { Logger } from '@deepkit/logger';
import { HttpRequest } from '../src/model';
import { ClassType } from '@deepkit/core';
import { TagProviders } from '@deepkit/app';
import { Stopwatch } from '@deepkit/stopwatch';

function createHttpKernel(controllers: ClassType[], providers: ProviderWithScope[] = []) {
    const tagProviders = new TagProviders();
    for (const provider of providers) if (provider instanceof Tag) tagProviders.tags.push(provider);
    const router = Router.forControllers(controllers, tagProviders);
    const injector = InjectorContext.forProviders([
        { provide: Router, useValue: router },
        ...controllers,
        ...providers,
        HttpListener,
        Logger,
        Stopwatch
    ]);
    const eventDispatcher = new EventDispatcher(injector);
    eventDispatcher.registerListener(HttpListener);
    return new HttpKernel(router, eventDispatcher, injector, new Logger(), new Stopwatch());
}

test('router', async () => {
    class Controller {
        @http.GET()
        helloWorld() {
        }

        @http.GET(':name')
        hello(name: string) {
        }

        @http.GET('/user/:id/static')
        userStatic(id: string) {
        }

        @http.GET('/user2/:id/static/:id2')
        userStatic2(id: string, id2: string) {
        }

        @http.GET('/static')
        static() {
        }
    }

    const router = Router.forControllers([Controller]);

    expect((await router.resolve('GET', '/'))?.routeConfig.action).toMatchObject({ controller: Controller, methodName: 'helloWorld' });
    expect((await router.resolve('GET', '/peter'))?.routeConfig.action).toMatchObject({ controller: Controller, methodName: 'hello' });
    expect((await router.resolve('GET', '/peter'))?.parameters!(undefined as any)).toEqual(['peter']);

    const userStatic = await router.resolve('GET', '/user/1233/static');
    expect(userStatic?.routeConfig.action).toMatchObject({ controller: Controller, methodName: 'userStatic' });
    expect(userStatic?.parameters!(undefined as any)).toEqual(['1233']);

    const userStatic2 = await router.resolve('GET', '/user2/1233/static/123');
    expect(userStatic2?.routeConfig.action).toMatchObject({ controller: Controller, methodName: 'userStatic2' });
    expect(userStatic2?.parameters!(undefined as any)).toEqual(['1233', '123']);
});

test('router parameters', async () => {
    class Controller {
        @http.GET('/user/:name')
        string(name: string) {
            return new JSONResponse(name);
        }

        @http.GET('/user-id/:id')
        number(id: number) {
            return new JSONResponse(id);
        }

        @http.GET('/boolean/:yes')
        boolean(yes: boolean) {
            return new JSONResponse(yes);
        }

        @http.GET(':path').regexp('path', '.*')
        any(path: string) {
            return new JSONResponse(path);
        }
    }

    const router = Router.forControllers([Controller]);
    expect((await router.resolve('GET', '/user/peter'))?.routeConfig.action).toMatchObject({ controller: Controller, methodName: 'string' });

    const httpKernel = createHttpKernel([Controller]);

    expect(await httpKernel.handleRequestFor('GET', '/user/peter')).toBe('peter');
    expect(await httpKernel.handleRequestFor('GET', '/user-id/123')).toBe(123);
    expect(await httpKernel.handleRequestFor('GET', '/user-id/asd')).toMatchObject({ message: 'Validation failed: id(No number given): invalid_number' });
    expect(await httpKernel.handleRequestFor('GET', '/boolean/1')).toBe(true);
    expect(await httpKernel.handleRequestFor('GET', '/boolean/false')).toBe(false);

    expect(await httpKernel.handleRequestFor('GET', '/any')).toBe('any');
    expect(await httpKernel.handleRequestFor('GET', '/any/path')).toBe('any/path');
});

test('router HttpRequest', async () => {
    class Controller {
        @http.GET(':path').regexp('path', '.*')
        anyReq(req: HttpRequest, path: string) {
            return [req.url, path];
        }
    }

    const httpKernel = createHttpKernel([Controller]);

    expect(await httpKernel.handleRequestFor('GET', '/req/any/path')).toEqual(['/req/any/path', 'req/any/path']);
});

test('router parameterResolver', async () => {
    class User {
        constructor(public username: string) {
        }
    }

    class Controller {
        @http.GET('user/:username')
        route1(user: User) {
            return [user.username];
        }

        @http.GET('group')
        route2(user: User) {
            return [user.username];
        }
    }

    class MyRouteParameterResolver {
        resolve(context: RouteParameterResolverContext): any | Promise<any> {
            if (!context.parameters.username) throw new Error('No :username specified');
            return new User(context.parameters.username);
        }
    }

    const httpKernel = createHttpKernel([Controller], [RouteParameterResolverTag.provide(MyRouteParameterResolver).forClassType(User)]);

    expect(await httpKernel.handleRequestFor('GET', '/user/peter')).toEqual(['peter']);
    expect(await httpKernel.handleRequestFor('GET', '/group')).toEqual('Internal error');
});

test('router body', async () => {
    class Body {
        @t username!: string;
    }

    class Controller {
        @http.POST()
        anyReq(@http.body() body: Body, req: HttpRequest) {
            return [body.username, body instanceof Body, req.url];
        }
    }

    const httpKernel = createHttpKernel([Controller]);

    expect(await httpKernel.handleRequestFor('POST', '/', { username: 'Peter' })).toEqual(['Peter', true, '/']);
});


test('router body double', async () => {
    class Body {
        @t username!: string;
    }

    class Controller {
        @http.POST()
        anyReq(@http.body() body: Body, @http.body() body2: Body, req: HttpRequest) {
            return [body2.username, body2 instanceof Body && body instanceof Body, req.url];
        }
    }

    const httpData = httpClass._fetch(Controller);
    if (!httpData) throw new Error('httpClass undefined');
    const action = [...httpData.getActions()][0];
    expect(action.methodName).toBe('anyReq');
    expect(action.httpMethod).toBe('POST');
    expect(action.parameters['body']).not.toBeUndefined();
    expect(action.parameters['body'].name).toBe('body');
    expect(action.parameters['body2']).not.toBeUndefined();
    expect(action.parameters['body2'].name).toBe('body2');

    const httpKernel = createHttpKernel([Controller]);

    expect(await httpKernel.handleRequestFor('POST', '/', { username: 'Peter' })).toEqual(['Peter', true, '/']);
});

test('router groups', async () => {
    {
        class Controller {
            @http.GET('a').group('a')
            a() {
            }

            @http.GET('b')
            b() {
            }

            @http.GET('c').group('c')
            c() {
            }
        }

        const httpData = httpClass._fetch(Controller);
        if (!httpData) throw new Error('httpClass undefined');
        expect(httpData.getAction('a').groups).toEqual(['a']);
        expect(httpData.getAction('b').groups).toEqual([]);
        expect(httpData.getAction('c').groups).toEqual(['c']);
    }

    {
        @http.groupAll('all')
        class Controller {
            @http.GET('a').group('a')
            a() {
            }

            @http.GET('b')
            b() {
            }

            @http.GET('c').group('c')
            c() {
            }
        }

        const httpData = httpClass._fetch(Controller);
        if (!httpData) throw new Error('httpClass undefined');
        expect(httpData.getAction('a').groups).toEqual(['a', 'all']);
        expect(httpData.getAction('b').groups).toEqual(['all']);
        expect(httpData.getAction('c').groups).toEqual(['c', 'all']);
    }

    expect(() => {
        @http.group('all')
        class ControllerC {
        }
    }).toThrow('Property decorators can only be used on class properties');
});

test('router query', async () => {
    class Controller {
        @http.GET('my-action')
        anyReq(@http.query().optional test?: number) {
            return test;
        }
    }

    const httpData = httpClass._fetch(Controller);
    if (!httpData) throw new Error('httpClass undefined');
    const action = [...httpData.getActions()][0];
    expect(action.methodName).toBe('anyReq');
    expect(action.httpMethod).toBe('GET');
    expect(action.parameters['test']).not.toBeUndefined();
    expect(action.parameters['test'].name).toBe('test');
    expect(action.parameters['test'].type).toBe('query');

    const httpKernel = createHttpKernel([Controller]);

    expect(await httpKernel.handleRequestFor('GET', '/my-action?test=123')).toEqual(123);
    expect(await httpKernel.handleRequestFor('GET', '/my-action')).toEqual(undefined);
});

test('router query all', async () => {
    class AnyReqQuery {
        @t.optional test?: string;
        @t.optional filter?: string;
        @t.optional page?: number;
    }

    class Controller {
        @http.GET('my-action')
        anyReq(@http.queries() anyReqQuery: AnyReqQuery) {
            return anyReqQuery;
        }
    }

    const httpKernel = createHttpKernel([Controller]);

    expect(await httpKernel.handleRequestFor('GET', '/my-action?test=123')).toEqual({ test: '123' });
    expect(await httpKernel.handleRequestFor('GET', '/my-action')).toEqual({});
    expect(await httpKernel.handleRequestFor('GET', '/my-action?filter=page&page=5')).toEqual({ filter: 'page', page: 5 });
});


test('router dotToUrlPath', () => {
    expect(dotToUrlPath('peter')).toBe('peter');
    expect(dotToUrlPath('foo.bar')).toBe('foo[bar]');
    expect(dotToUrlPath('foo.bar.deep')).toBe('foo[bar][deep]');
    expect(dotToUrlPath('foo.bar.deep.very')).toBe('foo[bar][deep][very]');
});

test('router url resolve', async () => {
    class AnyReqQuery {
        @t.optional test?: string;
        @t.optional filter?: string;
        @t.optional page?: number;
    }

    class Controller {
        @http.GET('').name('first')
        first() {
            return '';
        }

        @http.GET(':peter').name('second')
        second(peter: string) {
            return '';
        }

        @http.GET('').name('secondQuery')
        secondQuery(@http.query() peter: string) {
            return '';
        }

        @http.GET('').name('secondQuery2')
        secondQuery2(@http.query('changed') peter: string) {
            return '';
        }

        @http.GET('third').name('third')
        third(@http.queries() params: AnyReqQuery) {
            return params;
        }

        @http.GET('third2').name('third2')
        third2(@http.queries('deep') params: AnyReqQuery) {
            return params;
        }
    }

    const router = Router.forControllers([Controller]);

    expect(router.resolveUrl('first')).toBe('/');
    expect(router.resolveUrl('second', { peter: 'foo' })).toBe('/foo');
    expect(router.resolveUrl('secondQuery', { peter: 'foo' })).toBe('/?peter=foo');
    expect(router.resolveUrl('secondQuery2', { peter: 'foo' })).toBe('/?changed=foo');
    expect(router.resolveUrl('third', {})).toBe('/third');
    expect(router.resolveUrl('third', { params: { test: 123 } })).toBe('/third?test=123');
    expect(router.resolveUrl('third', { params: { test: 123, filter: 'peter' } })).toBe('/third?test=123&filter=peter');

    expect(router.resolveUrl('third2', {})).toBe('/third2');
    expect(router.resolveUrl('third2', { params: { test: 123 } })).toBe('/third2?deep[test]=123');
    expect(router.resolveUrl('third2', { params: { test: 123, filter: 'peter' } })).toBe('/third2?deep[test]=123&deep[filter]=peter');
});
