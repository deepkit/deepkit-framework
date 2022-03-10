import { expect, test } from '@jest/globals';
import { dotToUrlPath, RouteParameterResolverContext, Router, UploadedFile } from '../src/router';
import { http, httpClass } from '../src/decorator';
import { HttpBadRequestError, httpWorkflow, JSONResponse } from '../src/http';
import { eventDispatcher } from '@deepkit/event';
import { HttpBody, HttpBodyValidation, HttpQueries, HttpQuery, HttpRegExp, HttpRequest } from '../src/model';
import { getClassName, sleep } from '@deepkit/core';
import { createHttpKernel } from './utils';
import { Group, MinLength } from '@deepkit/type';

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

        @http.GET(':path')
        any(path: HttpRegExp<string, '.*'>) {
            return new JSONResponse(path);
        }
    }

    const router = Router.forControllers([Controller]);
    expect((await router.resolve('GET', '/user/peter'))?.routeConfig.action).toMatchObject({ controller: Controller, methodName: 'string' });

    const httpKernel = createHttpKernel([Controller]);

    expect((await httpKernel.request(HttpRequest.GET('/user/peter'))).json).toBe('peter');
    expect((await httpKernel.request(HttpRequest.GET('/user-id/123'))).json).toBe(123);
    expect((await httpKernel.request(HttpRequest.GET('/user-id/asd'))).json).toMatchObject({ message: 'Serialization failed. id: Cannot convert asd to number' });
    expect((await httpKernel.request(HttpRequest.GET('/boolean/1'))).json).toBe(true);
    expect((await httpKernel.request(HttpRequest.GET('/boolean/false'))).json).toBe(false);

    expect((await httpKernel.request(HttpRequest.GET('/any'))).json).toBe('any');
    expect((await httpKernel.request(HttpRequest.GET('/any/path'))).json).toBe('any/path');
});

test('router HttpRequest', async () => {
    class Controller {
        @http.GET(':path')
        anyReq(req: HttpRequest, path: HttpRegExp<string, '.*'>) {
            return [req.url, path];
        }
    }

    const httpKernel = createHttpKernel([Controller]);

    expect((await httpKernel.request(HttpRequest.GET('/req/any/path'))).json).toEqual(['/req/any/path', 'req/any/path']);
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

    expect((await httpKernel.request(HttpRequest.GET('/user/peter'))).json).toEqual(['peter']);
    expect((await httpKernel.request(HttpRequest.GET('/user/peter/group/a'))).json).toEqual(['peter', 'a']);
    expect((await httpKernel.request(HttpRequest.GET('/invalid'))).bodyString).toEqual('Internal error');
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
        errors: [{ code: 'minLength', message: 'Min length is 3', path: 'username' }], message: 'Validation error:\nusername(minLength): Min length is 3'
    });

    expect((await httpKernel.request(HttpRequest.POST('/action2').json({ username: 'Peter' }))).json).toEqual({ username: 'Peter' });
    expect((await httpKernel.request(HttpRequest.POST('/action2').json({ username: 'Pe' }))).bodyString).toEqual(`{"message":"Invalid: Min length is 3"}`);

    expect((await httpKernel.request(HttpRequest.POST('/action3').json({ username: 'Peter' }))).json).toEqual({ username: 'Peter' });
    expect((await httpKernel.request(HttpRequest.POST('/action3').json({ username: 'Pe' }))).bodyString).toEqual(`{"message":"Invalid: Min length is 3"}`);
});
