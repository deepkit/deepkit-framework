import { expect, test } from '@jest/globals';
import { http, HttpKernel, HttpRegExp, HttpRequest, JSONResponse, RouteParameterResolverContext } from '@deepkit/http';
import { FrameworkModule } from '../src/module.js';
import { createTestingApp } from '../src/testing.js';

test('router parameters', async () => {
    class Controller2 {
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

    const app = createTestingApp({ controllers: [Controller2], imports: [new FrameworkModule()] }).app;
    const httpHandler = app.get(HttpKernel);

    expect((await httpHandler.request(HttpRequest.GET('/user/peter'))).json).toBe('peter');
    expect((await httpHandler.request(HttpRequest.GET('/user-id/123'))).json).toBe(123);
    expect((await httpHandler.request(HttpRequest.GET('/user-id/asd'))).json).toMatchObject({ message: 'Validation error:\nid(type): Cannot convert asd to number' });
    expect((await httpHandler.request(HttpRequest.GET('/boolean/1'))).json).toBe(true);
    expect((await httpHandler.request(HttpRequest.GET('/boolean/false'))).json).toBe(false);

    expect((await httpHandler.request(HttpRequest.GET('/any'))).json).toBe('any');
    expect((await httpHandler.request(HttpRequest.GET('/any/path'))).json).toBe('any/path');
});


test('router parameterResolver', async () => {
    class User {
        constructor(public username: string) {
        }
    }

    class MyRouteParameterResolver {
        resolve(context: RouteParameterResolverContext): any | Promise<any> {
            if (!context.parameters.username) {
                throw new Error('No :username specified');
            }
            return new User(context.parameters.username);
        }
    }

    @http.resolveParameter(User, MyRouteParameterResolver)
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

    const app = createTestingApp({
        providers: [MyRouteParameterResolver],
        controllers: [Controller],
        imports: [new FrameworkModule()]
    }).app;
    const httpHandler = app.get(HttpKernel);

    expect((await httpHandler.request(HttpRequest.GET('/user/peter'))).json).toEqual(['peter']);
    expect((await httpHandler.request(HttpRequest.GET('/group'))).bodyString).toEqual('Internal error');
});
