import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { dotToUrlPath, RouteParameterResolverContext, Router } from '../src/router';
import { http, httpClass } from '../src/decorator';
import { getClassSchema, t } from '@deepkit/type';
import { httpWorkflow, JSONResponse } from '../src/http';
import { eventDispatcher } from '@deepkit/event';
import { inject } from '@deepkit/injector';
import { HttpRequest } from '../src/model';
import { getClassName, sleep } from '@deepkit/core';
import { createHttpKernel } from './utils';

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

        @http.ANY('/any')
        any() {
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

test('any', async () => {
    class Controller {
        @http.ANY('/any')
        any() {
        }
    }

    const router = Router.forControllers([Controller]);

    expect((await router.resolve('GET', '/any'))!.routeConfig.action.methodName).toEqual('any');
    expect((await router.resolve('POST', '/any'))!.routeConfig.action.methodName).toEqual('any');
    expect((await router.resolve('OPTIONS', '/any'))!.routeConfig.action.methodName).toEqual('any');
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
    expect(await httpKernel.handleRequestFor('GET', '/user-id/asd')).toMatchObject({ message: 'Validation failed: id(invalid_number): No valid number given, got NaN' });
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

test('router parameter resolver by class', async () => {
    class User {
        constructor(public username: string) {
        }
    }

    class Group {
        constructor(public name: string) {
        }
    }

    class UserResolver {
        resolve(context: RouteParameterResolverContext): any | Promise<any> {
            const value = context.value || context.parameters.username;
            if (!value) throw new Error('No value specified');
            return new User(value);
        }
    }

    class GroupResolver {
        resolve(context: RouteParameterResolverContext): any | Promise<any> {
            if (!context.value) throw new Error('No value specified');
            return new Group(context.value);
        }
    }

    @http.resolveParameter(User, UserResolver)
    class Controller {
        @http.GET('user/:username')
        route1(user: User) {
            return [user.username];
        }

        @http.GET('invalid')
        route2(user: User) {
            return [user.username];
        }

        @http.GET('user/:user/group/:group').resolveParameter(Group, GroupResolver)
        route3(user: User, group: Group) {
            return [user.username, group.name];
        }
    }

    const data = httpClass._fetch(Controller)!;
    expect(data.getActions().size).toBe(3);
    expect(data.resolverForToken.get(User)).toBe(UserResolver);
    expect(data.resolverForToken.get(User)).toBe(UserResolver);
    expect(data.getAction('route3').resolverForToken.get(Group)).toBe(GroupResolver);

    const httpKernel = createHttpKernel([Controller], [UserResolver, GroupResolver]);

    expect(await httpKernel.handleRequestFor('GET', '/user/peter')).toEqual(['peter']);
    expect(await httpKernel.handleRequestFor('GET', '/user/peter/group/a')).toEqual(['peter', 'a']);
    expect(await httpKernel.handleRequestFor('GET', '/invalid')).toEqual('Internal error');
});

test('router parameter resolver by name', async () => {
    class User {
        constructor(public username: string) {
        }
    }

    class Group {
        constructor(public name: string) {
        }
    }

    class UserResolver {
        resolve(context: RouteParameterResolverContext): any | Promise<any> {
            const value = context.value || context.parameters.username;
            if (!value) {
                throw new Error('No value specified');
            }
            return new User(value);
        }
    }

    class GroupResolver {
        resolve(context: RouteParameterResolverContext): any | Promise<any> {
            if (!context.value) throw new Error('No value specified');
            return new Group(context.value);
        }
    }

    class MyAuth {
        constructor(public name: string) {
        }
    }

    class AuthResolver {
        resolve(context: RouteParameterResolverContext): any | Promise<any> {
            return new MyAuth('auth');
        }
    }

    @http.resolveParameterByName('user', UserResolver)
    class Controller {
        @http.GET('user/:username')
        route1(user: User) {
            return [user.username];
        }

        @http.GET('invalid')
        route2(user: User) {
            return [user.username];
        }

        @http.GET('user/:user/group/:group').resolveParameterByName('group', GroupResolver)
        route3(user: User, group: Group) {
            return [user.username, group.name];
        }

        @http.GET('nonClass').resolveParameterByName('auth', AuthResolver)
        nonClass(auth: any) {
            return [auth.name, getClassName(auth)];
        }
    }

    const data = httpClass._fetch(Controller)!;
    expect(data.getActions().size).toBe(4);
    expect(data.resolverForParameterName.get('user')).toBe(UserResolver);
    expect(data.getAction('route3').resolverForParameterName.get('group')).toBe(GroupResolver);

    const httpKernel = createHttpKernel([Controller], [UserResolver, GroupResolver, AuthResolver]);

    expect(await httpKernel.handleRequestFor('GET', '/user/peter')).toEqual(['peter']);
    expect(await httpKernel.handleRequestFor('GET', '/user/peter/group/a')).toEqual(['peter', 'a']);
    expect(await httpKernel.handleRequestFor('GET', '/invalid')).toEqual('Internal error');
    expect(await httpKernel.handleRequestFor('GET', '/nonClass')).toEqual(['auth', 'MyAuth']);
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
    expect(action.httpMethods).toEqual(['POST']);
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
        @http.group('all')
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
    expect(action.httpMethods).toEqual(['GET']);
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

test('serializer options', async () => {
    class User {
        @t username!: string;
        @t.group('sensitive') password!: string;
    }

    class Controller {
        @http.GET().serialization({ groupsExclude: ['sensitive'] })
        @t.type(User)
        anyReq() {
            return { username: 'Peter', password: 'secret' };
        }
    }

    const httpKernel = createHttpKernel([Controller]);

    expect(await httpKernel.handleRequestFor('GET', '/')).toEqual({ username: 'Peter' });
});

test('hook after serializer', async () => {
    class User {
        @t username!: string;
        @t.group('sensitive') password!: string;
    }

    class Controller {
        @http.GET().serialization({ groupsExclude: ['sensitive'] })
        @t.type(User)
        async anyReq() {
            await sleep(0.1);
            return { username: 'Peter', password: 'secret' };
        }
    }

    class Listener {
        @eventDispatcher.listen(httpWorkflow.onResponse)
        onResponse(event: typeof httpWorkflow.onResponse.event) {
            event.result = { processingTime: event.controllerActionTime, data: event.result };
        }
    }

    const httpKernel = createHttpKernel([Controller], [], [Listener]);

    const result = await httpKernel.handleRequestFor('GET', '/');
    expect(result.data).toEqual({ username: 'Peter' });
    expect(result.processingTime).toBeGreaterThanOrEqual(99);
});

test('invalid route definition', async () => {
    class Controller {
        @http.GET()
        doIt(user: any) {
        }
    }

    const httpKernel = createHttpKernel([Controller]);
    expect(await httpKernel.handleRequestFor('GET', '/')).toEqual('Not found');
});


test('inject request storage ClassType', async () => {
    class User {
        constructor(public username: string) {
        }
    }

    class Controller {
        @http.GET()
        doIt(user: User) {
            return { isUser: user instanceof User, username: user.username };
        }

        @http.GET('optional')
        doItOptional(@inject().optional user?: User) {
            return { isUser: user instanceof User };
        }
    }

    class Listener {
        @eventDispatcher.listen(httpWorkflow.onAuth)
        onAuth(event: typeof httpWorkflow.onAuth.event) {
            if (event.request.headers.authorization === 'yes') {
                event.request.store.user = new User('bar');
            }
        }
    }

    const httpKernel = createHttpKernel([Controller], [
        {
            provide: User, scope: 'http', deps: [HttpRequest], useFactory(request: HttpRequest) {
                return request.store.user;
            }
        }
    ], [Listener]);

    expect(await httpKernel.handleRequestFor('GET', '/', undefined, { authorization: 'yes' })).toEqual({ isUser: true, username: 'bar' });
    expect(await httpKernel.handleRequestFor('GET', '/', undefined, { authorization: 'no' })).toEqual('Internal error');

    expect(await httpKernel.handleRequestFor('GET', '/optional', undefined, { authorization: 'no' })).toEqual({ isUser: false });
});


test('inject request storage @inject', async () => {
    class User {
        constructor(public username: string) {
        }
    }

    class Controller {
        @http.GET()
        doIt(@inject('user') user: any) {
            return { isUser: user instanceof User, username: user.username };
        }
    }

    class Listener {
        @eventDispatcher.listen(httpWorkflow.onAuth)
        onAuth(event: typeof httpWorkflow.onAuth.event) {
            event.request.store.user = new User('bar');
        }
    }

    const httpKernel = createHttpKernel([Controller], [
        {
            provide: 'user', scope: 'http', deps: [HttpRequest], useFactory(request: HttpRequest) {
                return request.store.user;
            }
        }
    ], [Listener]);

    const result = await httpKernel.handleRequestFor('GET', '/');
    expect(result.isUser).toBe(true);
    expect(result.username).toBe('bar');
});

test('custom request handling', async () => {
    class Listener {
        @eventDispatcher.listen(httpWorkflow.onRouteNotFound)
        onRouteNotFound(event: typeof httpWorkflow.onRouteNotFound.event) {
            //CORS requirement for example
            if (event.request.method === 'OPTIONS') event.send(new JSONResponse(true, 200));
        }
    }

    const httpKernel = createHttpKernel([], [], [Listener]);
    expect(await httpKernel.handleRequestFor('OPTIONS', '/')).toBe(true);
});

test('race condition', async () => {
    let call = 0;
    class Listener {
        @eventDispatcher.listen(httpWorkflow.onAuth)
        async onRouteNotFound(event: typeof httpWorkflow.onRouteNotFound.event) {
            if (call === 0) {
                await sleep(0.1);
            }
            call++;
        }
    }

    class Controller {
        @http.GET('/one/:param1')
        one(param1: string) {
            return param1;
        }

        @http.GET('/second/:param2')
        second(param2: string) {
            return param2;
        }
    }


    const httpKernel = createHttpKernel([Controller], [], [Listener]);

    const [a, b] = await Promise.all([
        httpKernel.handleRequestFor('GET', '/one/a'),
        httpKernel.handleRequestFor('GET', '/second/b'),
    ]);
    expect(a).toBe('a');
    expect(b).toBe('b');
});

test('multiple methods', async () => {
    class Controller {
        @http.GET('/one').POST()
        one() {
            return true;
        }
    }

    const httpKernel = createHttpKernel([Controller], [], []);

    expect((await httpKernel.request(HttpRequest.GET('/one'))).json).toBe(true);
    expect((await httpKernel.request(HttpRequest.POST('/one'))).json).toBe(true);
    expect((await httpKernel.request(HttpRequest.PATCH('/one'))).bodyString).toBe("Not found");
    expect((await httpKernel.request(HttpRequest.PUT('/one'))).bodyString).toBe("Not found");
});

test('promise serializer', async () => {
    class Controller {
        @http.GET('1')
        async anyReq1() {
            return 'test';
        }

        @http.GET('2')
        @t.string
        async anyReq2() {
            return 1;
        }
    }

    const httpKernel = createHttpKernel([Controller]);

    expect(await httpKernel.handleRequestFor('GET', '/1')).toBe('test');
    expect(await httpKernel.handleRequestFor('GET', '/2')).toBe('1');
});


test('unions', async () => {
    class Controller {
        @http.GET('/list')
        list(@http.query() @t.union(t.number, t.boolean) page: number | boolean) {
            return page;
        }
    }

    const httpKernel = createHttpKernel([Controller]);

    expect(await httpKernel.handleRequestFor('GET', '/list?page=1')).toEqual(1);
    expect(await httpKernel.handleRequestFor('GET', '/list?page=2222')).toEqual(2222);
    expect(await httpKernel.handleRequestFor('GET', '/list?page=false')).toEqual(false);
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

test('destructing params', async () => {

    class DTO {
        @t.required name!: string;
        @t.required title!: string;
    }

    class Controller {
        @http.GET('')
        first(@http.body() { name, title }: DTO) {
            return [name, title];
        }
    }

    const httpKernel = createHttpKernel([Controller]);

    expect((await httpKernel.request(HttpRequest.GET('/').json({name: 'Peter', title: 'CTO'}))).json).toEqual(['Peter', 'CTO']);
});

test('dynamic parameter name', async () => {
    @http.controller()
    class Controller {
        @http.GET('first/:another')
        first(@t.description('The identifier').name('another') id: string) {
            return [id];
        }

        @http.GET('second/:another2')
        second(@t.description('The identifier').name('another2') id: string, @http.query() second: string) {
            return [id, second];
        }
    }

    const schema = getClassSchema(Controller);
    expect(schema.getMethodProperties('first')[0].name).toBe('another');
    expect(schema.getMethodProperties('second')[0].name).toBe('another2');
    expect(schema.getMethodProperties('second')[1].name).toBe('second');

    const httpKernel = createHttpKernel([Controller]);

    expect((await httpKernel.request(HttpRequest.GET('/first/peter'))).json).toEqual(['peter']);
    expect((await httpKernel.request(HttpRequest.GET('/second/peter?second=true'))).json).toEqual(['peter', 'true']);
});
