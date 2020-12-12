import {expect, test} from '@jest/globals';
import 'reflect-metadata';
import {Router} from '../src/router';
import {HttpKernel, JSONResponse} from '../src/http';
import {http, httpClass} from '../src/decorator';
import {Application} from '../src/application';
import {IncomingMessage} from 'http';
import {t} from '@deepkit/type';

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

    expect((await router.resolve('GET', '/'))?.routeConfig.action).toMatchObject({controller: Controller, methodName: 'helloWorld'});
    expect((await router.resolve('GET', '/peter'))?.routeConfig.action).toMatchObject({controller: Controller, methodName: 'hello'});
    expect((await router.resolve('GET', '/peter'))?.parameters!(undefined as any)).toEqual(['peter']);

    const userStatic = await router.resolve('GET', '/user/1233/static');
    expect(userStatic?.routeConfig.action).toMatchObject({controller: Controller, methodName: 'userStatic'});
    expect(userStatic?.parameters!(undefined as any)).toEqual(['1233']);

    const userStatic2 = await router.resolve('GET', '/user2/1233/static/123');
    expect(userStatic2?.routeConfig.action).toMatchObject({controller: Controller, methodName: 'userStatic2'});
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

    const app = Application.create({controllers: [Controller]});
    const httpHandler = app.get(HttpKernel);

    expect(await httpHandler.handleRequestFor('GET', '/user/peter')).toBe('peter');
    expect(await httpHandler.handleRequestFor('GET', '/user-id/123')).toBe(123);
    await expect(httpHandler.handleRequestFor('GET', '/user-id/asd')).rejects.toThrow('Validation error');
    expect(await httpHandler.handleRequestFor('GET', '/boolean/1')).toBe(true);
    expect(await httpHandler.handleRequestFor('GET', '/boolean/false')).toBe(false);

    expect(await httpHandler.handleRequestFor('GET', '/any')).toBe('any');
    expect(await httpHandler.handleRequestFor('GET', '/any/path')).toBe('any/path');
});


test('router IncomingMessage', async () => {
    class Controller {
        @http.GET(':path').regexp('path', '.*')
        anyReq(req: IncomingMessage, path: string) {
            return [req.url, path];
        }
    }

    const app = Application.create({controllers: [Controller]});
    const httpHandler = app.get(HttpKernel);

    expect(await httpHandler.handleRequestFor('GET', '/req/any/path')).toEqual(['/req/any/path', 'req/any/path']);
});


test('router body', async () => {
    class Body {
        @t username!: string;
    }

    class Controller {
        @http.POST()
        anyReq(@http.body() body: Body, req: IncomingMessage) {
            return [body.username, body instanceof Body, req.url];
        }
    }

    const app = Application.create({controllers: [Controller]});
    const httpHandler = app.get(HttpKernel);

    expect(await httpHandler.handleRequestFor('POST', '/', {username: 'Peter'})).toEqual(['Peter', true, '/']);
});


test('router body double', async () => {
    class Body {
        @t username!: string;
    }

    class Controller {
        @http.POST()
        anyReq(@http.body() body: Body, @http.body() body2: Body, req: IncomingMessage) {
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

    const app = Application.create({controllers: [Controller]});
    const httpHandler = app.get(HttpKernel);

    expect(await httpHandler.handleRequestFor('POST', '/', {username: 'Peter'})).toEqual(['Peter', true, '/']);
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
        class ControllerC {}
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

    const app = Application.create({controllers: [Controller]});
    const httpHandler = app.get(HttpKernel);

    expect(await httpHandler.handleRequestFor('GET', '/my-action?test=123')).toEqual(123);
    expect(await httpHandler.handleRequestFor('GET', '/my-action')).toEqual(undefined);
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

    const app = Application.create({controllers: [Controller]});
    const httpHandler = app.get(HttpKernel);

    expect(await httpHandler.handleRequestFor('GET', '/my-action?test=123')).toEqual({test: '123'});
    expect(await httpHandler.handleRequestFor('GET', '/my-action')).toEqual({});
    expect(await httpHandler.handleRequestFor('GET', '/my-action?filter=page&page=5')).toEqual({filter: 'page', page: 5});
});
