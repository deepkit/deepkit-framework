import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { http, HttpKernel, JSONResponse, RouteParameterResolverContext, RouteParameterResolverTag } from '@deepkit/http';
import { Application } from '../src/application';

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

    const app = Application.create({ controllers: [Controller] });
    const httpHandler = app.get(HttpKernel);

    expect(await httpHandler.handleRequestFor('GET', '/user/peter')).toBe('peter');
    expect(await httpHandler.handleRequestFor('GET', '/user-id/123')).toBe(123);
    expect(await httpHandler.handleRequestFor('GET', '/user-id/asd')).toMatchObject({ message: 'Validation failed: id(invalid_number): No valid number given, got NaN' });
    expect(await httpHandler.handleRequestFor('GET', '/boolean/1')).toBe(true);
    expect(await httpHandler.handleRequestFor('GET', '/boolean/false')).toBe(false);

    expect(await httpHandler.handleRequestFor('GET', '/any')).toBe('any');
    expect(await httpHandler.handleRequestFor('GET', '/any/path')).toBe('any/path');
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

    const app = Application.create({
        providers: [RouteParameterResolverTag.provide(MyRouteParameterResolver)],
        controllers: [Controller],
    });
    const httpHandler = app.get(HttpKernel);

    expect(await httpHandler.handleRequestFor('GET', '/user/peter')).toEqual(['peter']);
    expect(await httpHandler.handleRequestFor('GET', '/group')).toEqual('Internal error');
});
