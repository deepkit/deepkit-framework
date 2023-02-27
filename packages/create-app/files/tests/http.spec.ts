import { expect, test } from '@jest/globals';
import { createTestingApp } from '@deepkit/framework';
import { Service } from '../src/app/service';
import { HelloWorldControllerHttp } from '../src/controller/hello-world.http';
import { HttpRequest } from '@deepkit/http';

test('http controller', async () => {
    const testing = createTestingApp({
        controllers: [HelloWorldControllerHttp],
        providers: [Service]
    });

    await testing.startServer();

    try {
        const response = await testing.request(HttpRequest.GET('/hello/World'));
        expect(response.statusCode).toBe(200);
        expect(response.json).toBe("Hello World!");
    } finally {
        await testing.stopServer();
    }
});
