import { http, HttpBody, HttpQueries } from '@deepkit/http';
import { entity } from '@deepkit/type';
import { createTestingApp } from '@deepkit/framework';
import { App } from '@deepkit/app';
import { beforeEach, describe, test, expect } from '@jest/globals';

import { fetchRequestHandler } from '../src/fetch-request-handler';

@entity.name('user')
class User {
    constructor(readonly name: string) {}
}

class CreateUserBody {
    name!: string;
}

class GetUserQuery {
    filter?: string;
}

class UserController {
    @http.GET('/user-query/:name')
    getUserQuery(name: string, query: HttpQueries<GetUserQuery>): User {
        expect(name).toEqual('Test');
        expect(query).toEqual({ filter: 'Hello' });
        return new User(name);
    }

    @http.GET('/user/:name')
    getUser(name: string): User {
        expect(name).toEqual('Test');
        return new User(name);
    }

    @http.POST('/user')
    createUser(body: HttpBody<CreateUserBody>): User {
        expect(body).toEqual({ name: 'Test' });
        return new User(body.name);
    }
}

describe('fetchRequestHandler', () => {
    let app: App<any>;

    beforeEach(() => {
        ({ app } = createTestingApp({
            controllers: [UserController],
        }));
    });

    test('GET query', async () => {
        const request = new Request(
            'http://localhost/user-query/Test?filter=Hello',
        );

        const response = await fetchRequestHandler({
            app,
            request,
        });

        await expect(response.json()).resolves.toEqual(new User('Test'));
    });

    test('GET', async () => {
        const request = new Request('http://localhost/user/Test');

        const response = await fetchRequestHandler({
            app,
            request,
        });

        await expect(response.json()).resolves.toEqual(new User('Test'));
    });

    test('POST', async () => {
        const request = new Request('http://localhost/user', {
            method: 'POST',
            body: JSON.stringify({ name: 'Test' }),
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const response = await fetchRequestHandler({
            app,
            request,
        });

        await expect(response.json()).resolves.toEqual(new User('Test'));
    });
});
