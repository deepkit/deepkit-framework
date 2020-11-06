import 'jest';
import 'reflect-metadata';
import {Router} from '../src/router';
import {HttpKernel} from '../src/http';
import {http} from '../src/decorator';
import {Application} from '../src/application';
import {ServiceContainer} from '../src/service-container';
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

        @http.GET('/user/:id/static2')
        userStatic2(id: string) {
        }

        @http.GET('/user/:id/static3')
        userStatic3(id: string) {
        }

        @http.GET('/user2/:id/static3')
        user2Static3(id: string) {
        }

        @http.GET('/static')
        static() {
        }
    }

    const router = Router.forControllers([Controller]);

    expect(await router.resolve('GET', '/')).toMatchObject({controller: Controller, method: 'helloWorld'});
    expect(await router.resolve('GET', '/peter')).toMatchObject({controller: Controller, method: 'hello'});
    expect((await router.resolve('GET', '/peter'))?.parameters!(undefined as any)).toEqual(['peter']);
    expect(await router.resolve('GET', '/user/1233/static')).toMatchObject({controller: Controller, method: 'userStatic'});
    expect((await router.resolve('GET', '/user/1233/static'))?.parameters!(undefined as any)).toEqual(['1233']);
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

        @http.GET(':path').regexp('path', '.*')
        any(path: string) {
            return path;
        }
    }

    const app = Application.root({controllers: [Controller]});
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

    const app = Application.root({controllers: [Controller]});
    const httpHandler = app.get(HttpKernel);

    expect(await httpHandler.handleRequestFor('GET', '/req/any/path')).toEqual(['/req/any/path', 'req/any/path']);
});


test('router body', async () => {
    class Body {
        @t username!: string;
    }

    class Controller {
        @http.POST()
        anyReq(body: Body, req: IncomingMessage) {
            return [body.username, body instanceof Body, req.url];
        }
    }

    const app = Application.root({controllers: [Controller]});
    const httpHandler = app.get(HttpKernel);

    expect(await httpHandler.handleRequestFor('POST', '/', {username: 'Peter'})).toEqual(['Peter', true, '/']);
});
