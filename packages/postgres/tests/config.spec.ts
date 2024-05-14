import { expect, test } from '@jest/globals';
import { parseConnectionString } from '../src/config.js';

test('basics', async () => {
    const config = parseConnectionString('postgres://user1:password2@localhost:5432/mydb');
    expect(config).toEqual({
        host: 'localhost',
        port: 5432,
        password: 'password2',
        database: 'mydb',
        user: 'user1'
    });
});

test('with-params', async () => {
    const config = parseConnectionString('postgres://user1:password2@localhost:5432/mydb?query_timeout=1000&keepAlive=true');
    expect(config).toEqual({
        host: 'localhost',
        port: 5432,
        password: 'password2',
        database: 'mydb',
        user: 'user1',
        query_timeout: 1000,
        keepAlive: true
    });
});
