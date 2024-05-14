import { expect, test } from '@jest/globals';
import { parseConnectionString } from '../src/config.js';

test('basics', async () => {
    const config = parseConnectionString('mysql://user1:password2@localhost:5432/mydb');
    expect(config).toEqual({
        host: 'localhost',
        port: 5432,
        password: 'password2',
        database: 'mydb',
        user: 'user1'
    });
});

test('with-params', async () => {
    const config = parseConnectionString('mysql://user1:password2@localhost:5432/mydb?acquireTimeout=1000&keepAliveDelay=5');
    expect(config).toEqual({
        host: 'localhost',
        port: 5432,
        password: 'password2',
        database: 'mydb',
        user: 'user1',
        acquireTimeout: 1000,
        keepAliveDelay: 5
    });
});
