import { expect, test } from '@jest/globals';
import { dotToUrlPath, HttpRouter, RouteClassControllerAction, RouteParameterResolverContext, UploadedFile } from '../src/router.js';
import { getActions, http, httpClass } from '../src/decorator.js';
import { HtmlResponse, HttpAccessDeniedError, HttpBadRequestError, HttpUnauthorizedError, httpWorkflow, JSONResponse, Response } from '../src/http.js';
import { eventDispatcher } from '@deepkit/event';
import { HttpBody, HttpBodyValidation, HttpHeader, HttpPath, HttpQueries, HttpQuery, HttpRegExp, HttpRequest } from '../src/model.js';
import { getClassName, isObject, sleep } from '@deepkit/core';
import { createHttpKernel } from './utils.js';
import { Excluded, Group, metaAnnotation, MinLength, PrimaryKey, Reference, serializer, Type, typeSettings, UnpopulatedCheck } from '@deepkit/type';
import { Readable } from 'stream';

test('router', async () => {
    class Controller {
        @http.GET()
        helloWorld() {
        }

        @http.GET('/a/:name')
        hello(name: string) {
        }

        @http.GET('/b/:name')
        helloButNoParam() {
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

    const router = HttpRouter.forControllers([Controller]);

    expect(router.resolve('GET', '/')?.routeConfig.action).toMatchObject({ controller: Controller, methodName: 'helloWorld' });
    expect(router.resolve('GET', '/a/peter')?.routeConfig.action).toMatchObject({ controller: Controller, methodName: 'hello' });
    expect(router.resolve('GET', '/a/peter')?.parameters!(undefined as any)).toEqual({ arguments: ['peter'], parameters: { name: 'peter' } });
    expect(router.resolve('GET', '/b/peter')).toBeDefined();

    const userStatic = router.resolve('GET', '/user/1233/static');
    expect(userStatic?.routeConfig.action).toMatchObject({ controller: Controller, methodName: 'userStatic' });
    expect(userStatic?.parameters!(undefined as any)).toEqual({ arguments: ['1233'], parameters: { id: '1233' } });

    const userStatic2 = router.resolve('GET', '/user2/1233/static/123');
    expect(userStatic2?.routeConfig.action).toMatchObject({ controller: Controller, methodName: 'userStatic2' });
    expect(userStatic2?.parameters!(undefined as any)).toEqual({ arguments: ['1233', '123'], parameters: { id: '1233', id2: '123' } });
});

test('explicitly annotated response objects', async () => {
    class Controller {
        @http.GET('/a')
        a(): JSONResponse {
            return new JSONResponse('a');
        }

        @http.GET('/b')
        b(): HtmlResponse {
            return new HtmlResponse('b');
        }

        @http.GET('/c')
        c(): Response {
            return new Response('c', 'text/plain');
        }

        @http.GET('/d')
        async d(): Promise<Response> {
            return new Response('d', 'text/plain');
        }
    }

    const httpKernel = createHttpKernel([Controller]);

    expect((await httpKernel.request(HttpRequest.GET('/a'))).bodyString).toBe('"a"');
    expect((await httpKernel.request(HttpRequest.GET('/b'))).bodyString).toBe('b');
    expect((await httpKernel.request(HttpRequest.GET('/c'))).bodyString).toBe('c');
    expect((await httpKernel.request(HttpRequest.GET('/d'))).bodyString).toBe('d');
});

test('any', async () => {
    class Controller {
        @http.ANY('/any')
        any() {
        }
    }

    const router = HttpRouter.forControllers([Controller]);

    expect(((await router.resolve('GET', '/any'))!.routeConfig.action as RouteClassControllerAction).methodName).toEqual('any');
    expect(((await router.resolve('POST', '/any'))!.routeConfig.action as RouteClassControllerAction).methodName).toEqual('any');
    expect(((await router.resolve('OPTIONS', '/any'))!.routeConfig.action as RouteClassControllerAction).methodName).toEqual('any');
});

test('explicitly annotated response objects', async () => {
    class Controller {
        @http.GET('/a')
        a(): JSONResponse {
            return new JSONResponse('a');
        }

        @http.GET('/b')
        b(): HtmlResponse {
            return new HtmlResponse('b');
        }

        @http.GET('/c')
        c(): Response {
            return new Response('c', 'text/plain');
        }
    }

    const httpKernel = createHttpKernel([Controller]);

    expect((await httpKernel.request(HttpRequest.GET('/a'))).bodyString).toBe('"a"');
    expect((await httpKernel.request(HttpRequest.GET('/b'))).bodyString).toBe('b');
    expect((await httpKernel.request(HttpRequest.GET('/c'))).bodyString).toBe('c');
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

        @http.GET(':path')
        any(path: HttpRegExp<string, '.*'>) {
            return new JSONResponse(path);
        }
    }

    const router = HttpRouter.forControllers([Controller]);
    expect((await router.resolve('GET', '/user/peter'))?.routeConfig.action).toMatchObject({ controller: Controller, methodName: 'string' });

    const httpKernel = createHttpKernel([Controller]);

    expect((await httpKernel.request(HttpRequest.GET('/user/peter'))).json).toBe('peter');
    expect((await httpKernel.request(HttpRequest.GET('/user-id/123'))).json).toBe(123);
    expect((await httpKernel.request(HttpRequest.GET('/user-id/asd'))).json).toMatchObject({ message: 'Validation error:\nid(type): Cannot convert asd to number' });
    expect((await httpKernel.request(HttpRequest.GET('/boolean/1'))).json).toBe(true);
    expect((await httpKernel.request(HttpRequest.GET('/boolean/false'))).json).toBe(false);

    expect((await httpKernel.request(HttpRequest.GET('/any'))).json).toBe('any');
    expect((await httpKernel.request(HttpRequest.GET('/any/path'))).json).toBe('any/path');
});

test('generic response', async () => {
    class Controller {
        @http.GET('xml')
        xml() {
            return new Response('<title>Hello</title>', 'text/xml');
        }
    }

    const httpKernel = createHttpKernel([Controller]);

    const xmlResponse = await httpKernel.request(HttpRequest.GET('/xml'));
    expect(xmlResponse.bodyString).toBe('<title>Hello</title>');
    expect(xmlResponse.getHeader('content-type')).toBe('text/xml');
});

test('HttpRegExp deep path', async () => {
    class Controller {
        @http.GET(':path')
        anyReq(req: HttpRequest, path: HttpRegExp<string, '.*'>) {
            return [req.url, path];
        }
    }

    const httpKernel = createHttpKernel([Controller]);

    expect((await httpKernel.request(HttpRequest.GET('/req/any/path'))).json).toEqual(['/req/any/path', 'req/any/path']);
});

test('HttpRegExp match', async () => {
    const pattern = /one|two/;

    class Controller {
        @http.GET('string/:text')
        text(text: HttpRegExp<string, '[a-zA-Z]*'>) {
            return [text];
        }

        @http.GET('number/:number')
        number(number: HttpRegExp<number, '[0-9]*'>) {
            return [number];
        }

        @http.GET('type/:type')
        type(type: HttpRegExp<string, typeof pattern>) {
            return [type];
        }

        @http.GET('type2/:type')
        type2(type: 'one' | 'two') {
            return [type];
        }
    }

    const httpKernel = createHttpKernel([Controller]);

    expect((await httpKernel.request(HttpRequest.GET('/number/23'))).json).toEqual([23]);
    expect((await httpKernel.request(HttpRequest.GET('/number/asd'))).statusCode).toBe(404);
    expect((await httpKernel.request(HttpRequest.GET('/string/peter'))).json).toEqual(['peter']);

    expect((await httpKernel.request(HttpRequest.GET('/type/one'))).json).toEqual(['one']);
    expect((await httpKernel.request(HttpRequest.GET('/type/two'))).json).toEqual(['two']);
    expect((await httpKernel.request(HttpRequest.GET('/type/nope'))).statusCode).toEqual(404);

    expect((await httpKernel.request(HttpRequest.GET('/type2/one'))).json).toEqual(['one']);
    expect((await httpKernel.request(HttpRequest.GET('/type2/two'))).json).toEqual(['two']);
    expect((await httpKernel.request(HttpRequest.GET('/type2/nope'))).statusCode).toEqual(400);
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
            if (!value) throw new HttpBadRequestError('No value specified');
            return new User(value);
        }
    }

    class GroupResolver {
        resolve(context: RouteParameterResolverContext): any | Promise<any> {
            if (!context.value) throw new HttpBadRequestError('No value specified');
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

    expect((await httpKernel.request(HttpRequest.GET('/user/peter'))).json).toEqual(['peter']);
    expect((await httpKernel.request(HttpRequest.GET('/user/peter/group/a'))).json).toEqual(['peter', 'a']);
    expect((await httpKernel.request(HttpRequest.GET('/invalid'))).bodyString).toEqual('{"message":"No value specified"}');
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

    expect((await httpKernel.request(HttpRequest.GET('/user/peter'))).json).toEqual(['peter']);
    expect((await httpKernel.request(HttpRequest.GET('/user/peter/group/a'))).json).toEqual(['peter', 'a']);
    expect((await httpKernel.request(HttpRequest.GET('/invalid'))).bodyString).toEqual('Internal error');
    expect((await httpKernel.request(HttpRequest.GET('/nonClass'))).json).toEqual(['auth', 'MyAuth']);
});

test('router body class', async () => {
    class Body {
        username!: string;
    }

    class Controller {
        @http.POST()
        anyReq(body: HttpBody<Body>, req: HttpRequest) {
            return [body.username, body instanceof Body, req.url];
        }
    }

    const httpKernel = createHttpKernel([Controller]);

    expect((await httpKernel.request(HttpRequest.POST('/').json({ username: 'Peter' }))).json).toEqual(['Peter', true, '/']);
});

test('router body is safe for simultaneous requests', async () => {
    class Body {
        username!: string;
    }

    class Controller {
        @http.POST()
        anyReq(body: HttpBody<Body>, req: HttpRequest) {
            return [body.username, body instanceof Body, req.url];
        }
    }

    const httpKernel = createHttpKernel([Controller]);

    const makeReq = () => httpKernel.request(HttpRequest.POST('/').json({ username: 'Peter' }));

    const results = await Promise.all([...new Array(100)].map(() => makeReq().then(res => res.json)));

    expect(results).toEqual(
        results.map(() => ['Peter', true, '/']),
    );
});

test('router body can be read multiple times', async () => {
    class Body {
        username!: string;
    }

    class Controller {
        @http.POST()
        async anyReq(body: HttpBody<Body>, req: HttpRequest) {
            return [body.username, await req.readBodyText(), req.url];
        }
    }

    const httpKernel = createHttpKernel([Controller]);

    expect((await httpKernel.request(HttpRequest.POST('/').json({ username: 'Peter' }))).json).toEqual(['Peter', '{"username":"Peter"}', '/']);
});

test('router body before it gets parsed', async () => {
    class Body {
        username!: string;
    }

    class Service {
        body?: string;
    }

    class Controller {
        constructor(private service: Service) {
        }

        @http.POST()
        async anyReq(body: HttpBody<Body>, req: HttpRequest) {
            expect(await req.readBodyText()).toBe(await req.readBodyText());
            return [body.username, await req.readBodyText(), this.service.body, req.url];
        }
    }

    const httpKernel = createHttpKernel([Controller], [Service], [
        httpWorkflow.onRequest.listen(async (event, service: Service) => {
            service.body = await event.request.readBodyText();
        })
    ]);

    expect((await httpKernel.request(HttpRequest.POST('/').json({ username: 'Peter' }))).json).toEqual(['Peter', '{"username":"Peter"}', '{"username":"Peter"}', '/']);
});

test('router body interface', async () => {
    interface Body {
        username: string;
    }

    class Controller {
        @http.POST()
        anyReq(body: HttpBody<Body>, req: HttpRequest) {
            return [body.username, typeof body.username, req.url];
        }
    }

    const httpKernel = createHttpKernel([Controller]);

    expect((await httpKernel.request(HttpRequest.POST('/').json({ username: 'Peter' }))).json).toEqual(['Peter', 'string', '/']);
});

test('router body double', async () => {
    class Body {
        username!: string;
    }

    class Controller {
        @http.POST()
        anyReq(body: HttpBody<Body>, body2: HttpBody<Body>, req: HttpRequest) {
            return [body2.username, body2 instanceof Body && body instanceof Body, req.url];
        }
    }

    const httpData = httpClass._fetch(Controller);
    if (!httpData) throw new Error('httpClass undefined');
    const action = [...httpData.getActions()][0];
    expect(action.methodName).toBe('anyReq');
    expect(action.httpMethods).toEqual(['POST']);

    const httpKernel = createHttpKernel([Controller]);

    expect((await httpKernel.request(HttpRequest.POST('/').json({ username: 'Peter' }))).json).toEqual(['Peter', true, '/']);
});

test('router query', async () => {
    class Controller {
        @http.GET('my-action')
        anyReq(test?: HttpQuery<number>) {
            return test;
        }
    }

    const httpData = httpClass._fetch(Controller);
    if (!httpData) throw new Error('httpClass undefined');
    const action = [...httpData.getActions()][0];
    expect(action.methodName).toBe('anyReq');
    expect(action.httpMethods).toEqual(['GET']);

    const httpKernel = createHttpKernel([Controller]);

    expect((await httpKernel.request(HttpRequest.GET('/my-action?test=123'))).json).toEqual(123);
    expect((await httpKernel.request(HttpRequest.GET('/my-action'))).bodyString).toEqual('');
});

test('router query all', async () => {
    class AnyReqQuery {
        test?: string;
        filter?: string;
        page?: number;
    }

    class Controller {
        @http.GET('my-action')
        anyReq(anyReqQuery: HttpQueries<AnyReqQuery>) {
            return anyReqQuery;
        }
    }

    const httpKernel = createHttpKernel([Controller]);

    expect((await httpKernel.request(HttpRequest.GET('/my-action?test=123'))).json).toEqual({ test: '123' });
    expect((await httpKernel.request(HttpRequest.GET('/my-action'))).json).toEqual({});
    expect((await httpKernel.request(HttpRequest.GET('/my-action?filter=page&page=5'))).json).toEqual({ filter: 'page', page: 5 });
});

test('serializer options', async () => {
    class User {
        username!: string;
        password!: string & Group<'sensitive'>;
    }

    class Controller {
        @http.GET().serialization({ groupsExclude: ['sensitive'] })
        anyReq(): User {
            return { username: 'Peter', password: 'secret' };
        }
    }

    const httpKernel = createHttpKernel([Controller]);

    expect((await httpKernel.request(HttpRequest.GET('/'))).json).toEqual({ username: 'Peter' });
});

test('hook after serializer', async () => {
    class User {
        username!: string;
        password!: string & Group<'sensitive'>;
    }

    class Controller {
        @http.GET().serialization({ groupsExclude: ['sensitive'] })
        async anyReq(): Promise<User> {
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

    const result = (await httpKernel.request(HttpRequest.GET('/'))).json;
    expect(result.data).toEqual({ username: 'Peter' });
    expect(result.processingTime).toBeGreaterThanOrEqual(99);
});

test('functional hooks', async () => {
    const httpKernel = createHttpKernel([], [], [
        httpWorkflow.onResponse.listen((event) => {
            event.result = { username: 'Peter' };
        })
    ]);

    const result = (await httpKernel.request(HttpRequest.GET('/'))).json;
    expect(result).toEqual({ username: 'Peter' });
});

test('invalid route definition', async () => {
    class Controller {
        @http.GET()
        doIt(user: any) {
        }
    }

    const httpKernel = createHttpKernel([Controller]);
    expect((await httpKernel.request(HttpRequest.GET('/'))).bodyString).toEqual('Internal error');
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
        doItOptional(user?: User) {
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
            provide: User, scope: 'http', useFactory(request: HttpRequest) {
                return request.store.user;
            }
        }
    ], [Listener]);

    expect((await httpKernel.request(HttpRequest.GET('/').headers({ authorization: 'yes' }))).json).toEqual({ isUser: true, username: 'bar' });
    expect((await httpKernel.request(HttpRequest.GET('/').headers({ authorization: 'no' }))).bodyString).toEqual('Internal error');

    expect((await httpKernel.request(HttpRequest.GET('/optional').headers({ authorization: 'no' }))).json).toEqual({ isUser: false });
});

test('functional listener', async () => {
    class Controller {
        @http.GET('hello')
        hello() {
            return 'hi';
        }
    }

    const gotUrls: string[] = [];

    const httpKernel = createHttpKernel([Controller], [], [
        httpWorkflow.onController.listen(event => {
            gotUrls.push(event.request.url || '');
        })
    ]);

    const response = await httpKernel.request(HttpRequest.GET('/hello'));
    expect(response.statusCode).toBe(200);
    expect(response.json).toBe('hi');
    expect(gotUrls).toEqual(['/hello']);
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
    expect((await httpKernel.request(HttpRequest.OPTIONS('/'))).json).toBe(true);
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
        httpKernel.request(HttpRequest.GET('/one/a')),
        httpKernel.request(HttpRequest.GET('/second/b')),
    ]);
    expect(a.json).toBe('a');
    expect(b.json).toBe('b');
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
    expect((await httpKernel.request(HttpRequest.PATCH('/one'))).bodyString).toBe('Not found');
    expect((await httpKernel.request(HttpRequest.PUT('/one'))).bodyString).toBe('Not found');
});

test('promise serializer', async () => {
    class Controller {
        @http.GET('1')
        async anyReq1() {
            return 'test';
        }

        @http.GET('2')
        async anyReq2(): Promise<string> {
            return 1 as any;
        }
    }

    const httpKernel = createHttpKernel([Controller]);

    expect((await httpKernel.request(HttpRequest.GET('/1'))).json).toBe('test');
    expect((await httpKernel.request(HttpRequest.GET('/2'))).json).toBe('1');
});

test('unions', async () => {
    class Controller {
        @http.GET('/list')
        list(page: HttpQuery<number | boolean>) {
            return page;
        }
    }

    const httpKernel = createHttpKernel([Controller]);

    expect((await httpKernel.request(HttpRequest.GET('/list?page=0'))).json).toEqual(0);
    expect((await httpKernel.request(HttpRequest.GET('/list?page=1'))).json).toEqual(1);
    expect((await httpKernel.request(HttpRequest.GET('/list?page=2222'))).json).toEqual(2222);
    expect((await httpKernel.request(HttpRequest.GET('/list?page=false'))).json).toEqual(false);
    expect((await httpKernel.request(HttpRequest.GET('/list?page=true'))).json).toEqual(true);

    expect((await httpKernel.request(HttpRequest.GET('/list?page=asdasdc'))).json).toMatchObject({
        'errors': [
            {
                'code': 'type',
                'message': 'No value given',
                'path': 'page'
            }
        ],
    });
});

test('router dotToUrlPath', () => {
    expect(dotToUrlPath('peter')).toBe('peter');
    expect(dotToUrlPath('foo.bar')).toBe('foo[bar]');
    expect(dotToUrlPath('foo.bar.deep')).toBe('foo[bar][deep]');
    expect(dotToUrlPath('foo.bar.deep.very')).toBe('foo[bar][deep][very]');
});

test('router url resolve', async () => {
    class AnyReqQuery {
        test?: string;
        filter?: string;
        page?: number;
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
        secondQuery(peter: HttpQuery<string>) {
            return '';
        }

        @http.GET('').name('secondQuery2')
        secondQuery2(peter: HttpQuery<string, { name: 'changed' }>) {
            return '';
        }

        @http.GET('third').name('third')
        third(params: HttpQueries<AnyReqQuery>) {
            return params;
        }

        @http.GET('third2').name('third2')
        third2(params: HttpQueries<AnyReqQuery, { name: 'deep' }>) {
            return params;
        }
    }

    const router = HttpRouter.forControllers([Controller]);

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
    interface DTO {
        name: string;
        title: string;
    }

    class Controller {
        @http.GET('')
        first({ name, title }: HttpBody<DTO>) {
            return [name, title];
        }
    }

    const httpKernel = createHttpKernel([Controller]);

    expect((await httpKernel.request(HttpRequest.GET('/').json({ name: 'Peter', title: 'CTO' }))).json).toEqual(['Peter', 'CTO']);
});

test('use http.response for serialization', async () => {
    interface DefaultResponse {
        title: string;
    }

    interface ErrorResponse {
        message: string;
    }

    class Controller {
        @http.GET('/action1')
        action1(): DefaultResponse[] {
            return [{ title: 'a' }, { title: '1' }];
        }

        @http.GET('/action2').response<DefaultResponse[]>(200, `List`)
        action2() {
            return [{ title: 'a' }, { title: 1 }];
        }

        @http.GET('/action3')
            .response<DefaultResponse[]>(200, `List`)
            .response<ErrorResponse[]>(400, `Error`)
        action3() {
            return new JSONResponse([{ message: 'error' }, { message: 1 }]).status(400);
        }
    }

    const httpKernel = createHttpKernel([Controller]);
    expect((await httpKernel.request(HttpRequest.GET('/action1'))).json).toEqual([{ title: 'a' }, { title: '1' }]);
    expect((await httpKernel.request(HttpRequest.GET('/action2'))).json).toEqual([{ title: 'a' }, { title: '1' }]);
    expect((await httpKernel.request(HttpRequest.GET('/action3'))).json).toEqual([{ message: 'error' }, { message: '1' }]);
});

test('reference in query', async () => {
    interface Group {
        id: number & PrimaryKey;
    }

    interface User {
        id: number;
        group: Group & Reference;
    }

    class Controller {
        @http.GET('/user')
        action1(filter: HttpQuery<Partial<User>>) {
            return {
                isGroup: isObject(filter.group),
                objectName: getClassName(filter.group!),
                groupId: filter.group!.id,
            };
        }
    }

    const httpKernel = createHttpKernel([Controller]);
    expect((await httpKernel.request(HttpRequest.GET('/user?filter[group]=2'))).json).toEqual({
        isGroup: true,
        objectName: 'ObjectReference',
        groupId: 2,
    });
});

test('BodyValidation', async () => {
    class User {
        username!: string & MinLength<3>;
    }

    class AddUserDto extends User {
        imageUpload?: UploadedFile;
    }

    class Controller {
        @http.POST('/action1')
        action1(user: HttpBody<User>): any {
            return user;
        }

        @http.POST('/action2')
        action2(user: HttpBodyValidation<User>): User {
            if (user.valid()) {
                return user.value;
            }

            throw new HttpBadRequestError('Invalid: ' + user.error.getErrorMessageForPath('username'));
        }

        @http.POST('/action3')
        action3(user: HttpBodyValidation<AddUserDto>): User {
            if (user.valid()) {
                return user.value;
            }

            throw new HttpBadRequestError('Invalid: ' + user.error.getErrorMessageForPath('username'));
        }
    }

    const httpKernel = createHttpKernel([Controller]);
    expect((await httpKernel.request(HttpRequest.POST('/action1').json({ username: 'Peter' }))).json).toEqual({ username: 'Peter' });
    expect((await httpKernel.request(HttpRequest.POST('/action1').json({ username: 'Pe' }))).json).toEqual({
        errors: [{ code: 'minLength', message: 'Min length is 3', path: 'username', value: 'Pe' }], message: 'Validation error:\nusername(minLength): Min length is 3'
    });

    expect((await httpKernel.request(HttpRequest.POST('/action2').json({ username: 'Peter' }))).json).toEqual({ username: 'Peter' });
    expect((await httpKernel.request(HttpRequest.POST('/action2').json({ username: 'Pe' }))).bodyString).toEqual(`{"message":"Invalid: Min length is 3"}`);

    expect((await httpKernel.request(HttpRequest.POST('/action3').json({ username: 'Peter' }))).json).toEqual({ username: 'Peter' });
    expect((await httpKernel.request(HttpRequest.POST('/action3').json({ username: 'Pe' }))).bodyString).toEqual(`{"message":"Invalid: Min length is 3"}`);
});

test('unpopulated entity without type information', async () => {
    interface Group {
        id: number & PrimaryKey;
    }

    class User {
        invisible: boolean & Excluded = false;

        constructor(public id: number, public group: Group & Reference) {
        }
    }


    function disableReference(o: User) {
        //we simulate an unpopulated reference
        Object.defineProperty(o, 'group', {
            get() {
                if (typeSettings.unpopulatedCheck === UnpopulatedCheck.Throw) {
                    throw new Error(`Reference group was not populated. Use joinWith(), useJoinWith(), etc to populate the reference.`);
                }
            }
        });
    }

    class Controller {
        @http.GET('/1')
        action1() {
            const o = new User(2, undefined as any);
            disableReference(o);
            return [o];
        }

        @http.GET('/2')
        async action2(): Promise<User[]> {
            const o = new User(2, undefined as any);
            disableReference(o);
            return [o];
        }

        @http.GET('/3').response<User[]>(200)
        async action3() {
            const o = new User(2, undefined as any);
            disableReference(o);
            return [o];
        }

        @http.GET('/4')
        async action4() {
            const o = new User(2, undefined as any);
            disableReference(o);
            return [o, { another: 3 }];
        }
    }

    const httpKernel = createHttpKernel([Controller]);
    expect((await httpKernel.request(HttpRequest.GET('/1'))).json).toEqual([{ id: 2 }]);
    expect((await httpKernel.request(HttpRequest.GET('/2'))).json).toEqual([{ id: 2 }]);
    expect((await httpKernel.request(HttpRequest.GET('/3'))).json).toEqual([{ id: 2 }]);
    expect((await httpKernel.request(HttpRequest.GET('/4'))).json).toEqual([{ id: 2, invisible: false }, { another: 3 }]);
});

test('extend with custom type', async () => {
    type StringifyTransport = { __meta?: never & ['stringifyTransport'] };

    function isStringifyTransportType(type: Type): boolean {
        return !!metaAnnotation.getForName(type, 'stringifyTransport');
    }

    serializer.serializeRegistry.addPostHook((type, state) => {
        if (!isStringifyTransportType(type)) return;
        state.addSetter(`JSON.stringify(${state.accessor})`);
    });
    serializer.deserializeRegistry.addPreHook((type, state) => {
        if (!isStringifyTransportType(type)) return;
        state.addSetter(`JSON.parse(${state.accessor})`);
    });

    class MyType {
        test!: string;
    }

    class Entity {
        obj: MyType & StringifyTransport = { test: 'abc' };
    }


    class Controller {
        @http.GET('/1')
        action1(entity: HttpQueries<Entity>) {
            return entity.obj;
        }
    }

    const httpKernel = createHttpKernel([Controller]);
    expect((await httpKernel.request(HttpRequest.GET('/1?obj={"test": "def"}'))).json).toEqual({ test: 'def' });
});


test('session', async () => {
    class User {
        constructor(public username: string) {
        }
    }

    class HttpSession {
        protected user?: User;

        getUser(): User {
            if (!this.user) throw new Error('Not authorized');
            return this.user;
        }

        setUser(user: User) {
            this.user = user;
        }
    }

    class Controller {
        @http.GET('/1')
        handle(session: HttpSession) {
            return session.getUser().username;
        }
    }

    const httpKernel = createHttpKernel([Controller], [{
        provide: HttpSession, scope: 'http'
    }], [httpWorkflow.onRequest.listen(async (event) => {
        const auth = event.request.headers['auth'];
        if (auth) {
            const session = event.injectorContext.get(HttpSession);
            //load user from somewhere
            session.setUser(new User('abc'));
        }
    })]);
    expect((await httpKernel.request(HttpRequest.GET('/1').header('auth', '123'))).json).toEqual('abc');
});

test('route listener parameters', async () => {
    class HttpSession {
    }

    class Controller {
        @http.GET('/:groupId/:userId')
        handle(userId: number, groupId: number, session: HttpSession) {
            return [userId, groupId, session instanceof HttpSession];
        }
    }

    const httpKernel = createHttpKernel([Controller], [{
        provide: HttpSession, scope: 'http'
    }], [httpWorkflow.onController.listen(async (event, session: HttpSession) => {
        expect(event.parameters.arguments).toEqual([2, 1, session]);
        expect(event.parameters.parameters).toEqual({ userId: 2, groupId: 1, session: session });
    })]);
    expect((await httpKernel.request(HttpRequest.GET('/1/2'))).json).toEqual([2, 1, true]);
});

test('parameter in controller class url', async () => {
    @http.controller('/:groupId')
    class Controller {
        @http.GET('/:userId')
        handle(userId: number, groupId: number) {
            return [userId, groupId];
        }
    }

    const httpKernel = createHttpKernel([Controller], [], [httpWorkflow.onController.listen(async (event) => {
        expect(event.parameters.arguments).toEqual([2, 1]);
        expect(event.parameters.parameters).toEqual({ userId: 2, groupId: 1 });
    })]);
    expect((await httpKernel.request(HttpRequest.GET('/1/2'))).json).toEqual([2, 1]);
});

test('parameter from header', async () => {
    class Controller {
        @http.GET('/:userId')
        handle(userId: number, groupId: HttpHeader<number>) {
            return [userId, groupId];
        }
    }

    const httpKernel = createHttpKernel([Controller], [], [httpWorkflow.onController.listen(async (event) => {
        expect(event.parameters.arguments).toEqual([2, 1]);
        expect(event.parameters.parameters).toEqual({ userId: 2, groupId: 1 });
    })]);
    expect((await httpKernel.request(HttpRequest.GET('/2').header('groupId', 1))).json).toEqual([2, 1]);
});

test('parameter in for listener', async () => {
    class HttpSession {
        groupId2?: number;

        getGroupId(): number {
            if (!this.groupId2) throw new Error('Not authorized');
            return this.groupId2;
        }
    }

    @http.controller('/:groupId')
    class Controller {
        @http.GET('/:userId')
        handle(userId: number, session: HttpSession) {
            return [userId, session.groupId2];
        }
    }

    const httpKernel = createHttpKernel([Controller], [{ provide: HttpSession, scope: 'http' }], [
        httpWorkflow.onController.listen(async (event, session: HttpSession, groupId: HttpPath<number>, authorization?: HttpHeader<string>) => {
            //just as example: when groupId is bigger than 100 we require an authorization header
            if (groupId > 100) {
                if (authorization !== 'secretToken') throw new HttpUnauthorizedError('Not authorized');
            }

            session.groupId2 = groupId;
        })
    ]);
    expect((await httpKernel.request(HttpRequest.GET('/1/2'))).json).toEqual([2, 1]);
    expect((await httpKernel.request(HttpRequest.GET('/101/2').header('authorization', 'secretToken'))).json).toEqual([2, 101]);
    expect((await httpKernel.request(HttpRequest.GET('/101/2').header('authorization', 'invalid'))).json).toEqual({ 'message': 'Not authorized' });
});

test('query parameter in for listener', async () => {
    class HttpSession {
        userId?: number;

        getUserId(): number {
            if (!this.userId) throw new Error('Not authorized');
            return this.userId;
        }
    }

    class Controller {
        @http.GET('/:pageId')
        handle(pageId: number, session: HttpSession) {
            return [pageId, session.getUserId()];
        }
    }

    const httpKernel = createHttpKernel([Controller], [{ provide: HttpSession, scope: 'http' }], [
        httpWorkflow.onController.listen(async (event, session: HttpSession, auth: HttpQuery<string>) => {
            console.log('auth', auth);
            const users: { [key: string]: number } = {
                'secretToken1': 1,
                'secretToken2': 2,
            };
            if (!users[auth]) throw new HttpUnauthorizedError('Invalid auth token');
            session.userId = users[auth];
        })
    ]);
    expect((await httpKernel.request(HttpRequest.GET('/2?auth=secretToken1'))).json).toEqual([2, 1]);
    expect((await httpKernel.request(HttpRequest.GET('/3?auth=secretToken2'))).json).toEqual([3, 2]);
    expect((await httpKernel.request(HttpRequest.GET('/3?auth=invalidToken'))).json).toEqual({ 'message': 'Invalid auth token' });
});

test('queries parameter in for listener', async () => {
    class HttpSession {
        constructor(public auth: string = '', public userId: number = 0) {
        }
    }

    class Controller {
        @http.GET('/')
        handle(userId: HttpQuery<number>, session: HttpSession) {
            return [userId, session.userId, session.auth];
        }
    }

    const httpKernel = createHttpKernel([Controller], [{ provide: HttpSession, scope: 'http' }], [
        httpWorkflow.onController.listen(async (event, session: HttpSession, auth: HttpQueries<{ auth: string, userId: number }>) => {
            session.auth = auth.auth;
            session.userId = auth.userId;
        })
    ]);
    expect((await httpKernel.request(HttpRequest.GET('/?auth=secretToken1&userId=1'))).json).toEqual([1, 1, 'secretToken1']);
    expect((await httpKernel.request(HttpRequest.GET('/?userId=1'))).json.message).toEqual('Validation error:\nauth.auth(type): Not a string');
});

test('http parameter in class listener', async () => {
    @http.controller('/:groupId')
    class Controller {
        @http.GET('/:userId')
        handle(userId: number, request: HttpRequest) {
            return [userId, request.store.groupId];
        }
    }

    class Listener {
        @eventDispatcher.listen(httpWorkflow.onController)
        handle(event: typeof httpWorkflow.onController.event, request: HttpRequest, groupId: HttpPath<number>) {
            request.store.groupId = groupId;
        }
    }

    const httpKernel = createHttpKernel([Controller], [], [Listener]);
    expect((await httpKernel.request(HttpRequest.GET('/1/2'))).json).toEqual([2, 1]);
});

test('queries parameter in class listener', async () => {
    class HttpSession {
        constructor(public auth: string = '', public userId: number = 0) {
        }
    }

    class Controller {
        @http.GET('/')
        handle(userId: HttpQuery<number>, session: HttpSession) {
            return [userId, session.userId, session.auth];
        }
    }

    class Listener {
        @eventDispatcher.listen(httpWorkflow.onController)
        handle(event: typeof httpWorkflow.onController.event, session: HttpSession, auth: HttpQueries<{ auth: string, userId: number }>) {
            session.auth = auth.auth;
            session.userId = auth.userId;
        }
    }

    const httpKernel = createHttpKernel([Controller], [{ provide: HttpSession, scope: 'http' }], [Listener]);
    expect((await httpKernel.request(HttpRequest.GET('/?auth=secretToken1&userId=1'))).json).toEqual([1, 1, 'secretToken1']);
    expect((await httpKernel.request(HttpRequest.GET('/?userId=1'))).json.message).toEqual('Validation error:\nauth.auth(type): Not a string');
});

test('stream', async () => {
    class Controller {
        @http.GET()
        handle() {
            return Readable.from(['test']);
        }
    }

    const httpKernel = createHttpKernel([Controller]);
    const response = (await httpKernel.request(HttpRequest.GET('/')));
    expect(response.statusCode).toBe(200);
    await sleep(0);
    expect(response.bodyString).toBe('test');
});

test('stream error', async () => {
    class Controller {
        @http.GET()
        handle() {
            return new Readable().emit('error', new Error('this is my error'));
        }
    }

    const httpKernel = createHttpKernel([Controller]);
    const response = (await httpKernel.request(HttpRequest.GET('/')));
    expect(response.statusCode).toBe(500);
    expect(response.bodyString).toBe('Internal error');
});

test('issue-415: serialize literal types in union', async () => {
    enum MyEnum {
        VALUE_0 = 0,
        VALUE_180 = 180
    }

    class Data {
        rotate: MyEnum.VALUE_180 | MyEnum.VALUE_0 = MyEnum.VALUE_0;
    }

    class Controller {
        @http.GET()
        handle(query: HttpQueries<Data>) {
            return query.rotate;
        }
    }

    const httpKernel = createHttpKernel([Controller]);
    expect((await httpKernel.request(HttpRequest.GET('/?rotate=0'))).json).toEqual(0);
    expect((await httpKernel.request(HttpRequest.GET('/?rotate=180'))).json).toEqual(180);
    expect((await httpKernel.request(HttpRequest.GET('/?rotate=555454'))).json).toEqual(0);
});

test('fetch thrown error instances in listeners', async () => {
    class Controller {
        @http.GET()
        handle() {
            throw new HttpAccessDeniedError('my custom "Access denied" message');
        }
    }

    const httpKernel = createHttpKernel([Controller], [], [
        httpWorkflow.onAccessDenied.listen(async (event) => {
            expect(event.error?.message).toBe('my custom "Access denied" message');
        }),
    ]);

    expect((await httpKernel.request(HttpRequest.GET('/'))).statusCode).toEqual(403);
});

test('upload security', async () => {
    class UploadBody {
        someFile!: UploadedFile;
    }

    class Controller {
        @http.POST('/upload')
        upload(body: HttpBody<UploadBody>): any {
            return { uploadedSize: body.someFile.size };
        }
    }

    const httpKernel = createHttpKernel([Controller]);

    expect((await httpKernel.request(HttpRequest.POST('/upload').json({
        someFile: {
            size: 12345,
            path: '/etc/secure-file',
            name: 'fakefile',
            type: 'image/jpeg',
            lastModifiedDate: null
        }
    }))).json).toMatchObject({
        message: 'Validation error:\nsomeFile(uploadSecurity): Not an uploaded file'
    });

    // ensure type deserialization doesn't set the invalid 'fake value' value to UploadedFileSymbol
    expect((await httpKernel.request(HttpRequest.POST('/upload').json({
        someFile: {
            validator: 'fake value',
            size: 12345,
            path: '/etc/secure-file',
            name: 'fakefile',
            type: 'image/jpeg',
            lastModifiedDate: null
        }
    }))).json).toMatchObject({
        message: 'Validation error:\nsomeFile(uploadSecurity): Not an uploaded file'
    });

    expect((await httpKernel.request(HttpRequest.POST('/upload').multiPart([
        {
            name: 'someFile',
            file: Buffer.from('testing a text file'),
            fileName: 'test.txt'
        }
    ]))).json).toMatchObject({ uploadedSize: 19 });
});

test('any http body', async () => {
    class Controller {
        @http.PUT('/test')
        upload(body: HttpBody<any>): any {
            return { test: body.test };
        }
    }

    const httpKernel = createHttpKernel([Controller]);

    const response = await httpKernel.request(HttpRequest.PUT('/test').json({ test: 'test' }));
    expect(response.json).toMatchObject({ test: 'test' });
});

test('controller inheritance', async () => {
    class Base {
        @http.GET('/test1')
        test1() {
            return 'test1';
        }

        @http.GET('/test2')
        test2() {
            return 'test2';
        }
    }

    class Controller extends Base {
        @http.GET('/test2')
        test2() {
            return 'test2-2';
        }

        @http.GET('/test3')
        test3() {
            return 'test3';
        }
    }

    const actions = getActions(Controller);
    expect(actions).toHaveLength(3);

    const router = HttpRouter.forControllers([Controller]);
    expect(router.resolve('GET', '/test1')?.routeConfig.action).toMatchObject({ controller: Controller, methodName: 'test1' });
    expect(router.resolve('GET', '/test2')?.routeConfig.action).toMatchObject({ controller: Controller, methodName: 'test2' });
    expect(router.resolve('GET', '/test3')?.routeConfig.action).toMatchObject({ controller: Controller, methodName: 'test3' });

    const httpKernel = createHttpKernel([Controller]);
    expect((await httpKernel.request(HttpRequest.GET('/test1'))).json).toEqual('test1');
    expect((await httpKernel.request(HttpRequest.GET('/test2'))).json).toEqual('test2-2');
    expect((await httpKernel.request(HttpRequest.GET('/test3'))).json).toEqual('test3');
});
