import { expect, test } from '@jest/globals';

import { HttpDecorator, http } from '../src/decorator.js';
import { HttpKernel } from '../src/kernel.js';
import { HttpBody, HttpRequest } from '../src/model.js';
import { HttpRouter, HttpRouterRegistry } from '../src/router.js';
import { createHttpApp, createHttpKernel } from './utils.js';

test('router basics', async () => {
    const httpKernel = createHttpKernel((registry: HttpRouterRegistry) => {
        registry.get('/', () => {
            return 'Hello World';
        });
        registry.get('/:text', (text: string) => {
            return 'Hello ' + text;
        });
    });

    expect((await httpKernel.request(HttpRequest.GET('/'))).json).toEqual('Hello World');
    expect((await httpKernel.request(HttpRequest.GET('/Galaxy'))).json).toEqual('Hello Galaxy');
});

test('router di', async () => {
    const httpKernel = createHttpKernel((registry: HttpRouterRegistry) => {
        registry.get('/:text', (text: string, request: HttpRequest) => {
            return ['Hello ' + text, request instanceof HttpRequest];
        });
    });

    expect((await httpKernel.request(HttpRequest.GET('/Galaxy'))).json).toEqual(['Hello Galaxy', true]);
});

test('router post', async () => {
    const httpKernel = createHttpKernel((registry: HttpRouterRegistry) => {
        interface User {
            id: number;
        }

        registry.post('/', (user: HttpBody<User>, request: HttpRequest) => {
            return [user, request instanceof HttpRequest];
        });
    });

    expect((await httpKernel.request(HttpRequest.POST('/').json({ id: 23 }))).json).toEqual([{ id: 23 }, true]);
});

test('router options', async () => {
    const app = createHttpApp();
    const registry = app.get(HttpRouterRegistry);

    registry.get({ path: '/user/:id', name: 'user_details' }, (id: number) => {
        return id;
    });

    const router = app.get(HttpRouter);
    expect(router.resolveUrl('user_details', { id: 12 })).toBe('/user/12');

    const kernel = app.get(HttpKernel);

    expect((await kernel.request(HttpRequest.GET('/user/23'))).json).toEqual(23);
});

test('router decorator options', async () => {
    const app = createHttpApp();
    const registry = app.get(HttpRouterRegistry);

    function withError(http: HttpDecorator) {
        return http.response<any>(400, 'on error');
    }

    registry.add(withError(http.GET('/user/:id').name('user_details')), (id: number) => {
        return id;
    });

    const router = app.get(HttpRouter);
    expect(router.resolveUrl('user_details', { id: 12 })).toBe('/user/12');

    const kernel = app.get(HttpKernel);

    expect((await kernel.request(HttpRequest.GET('/user/23'))).json).toEqual(23);
});
