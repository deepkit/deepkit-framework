import { App } from '@deepkit/app';
import { FrameworkModule } from '../src/lib/module.js';
import { expect, test } from '@jest/globals';
import { HttpBody, HttpKernel, HttpRequest, HttpRouterRegistry } from '@deepkit/http';
import { Logger } from '@deepkit/logger';
import { createTestingApp } from '../src/lib/testing.js';

test('functional http app', async () => {
    const test = createTestingApp({
        imports: [new FrameworkModule()]
    });

    const router = test.app.get(HttpRouterRegistry);

    router.get('/greet/:name', (name: string, logger: Logger) => {
        logger.log(`${name} was greeted`);
        return `Greetings ${name}`;
    });

    const httpKernel = test.app.get(HttpKernel);
    const response = await httpKernel.request(HttpRequest.GET('/greet/Peter'));
    expect(response.json).toBe('Greetings Peter');
});

test('http parse config', async () => {
    const test = createTestingApp({
        imports: [new FrameworkModule({
            httpParse: {
                maxFields: 1
            }
        })]
    });

    const router = test.app.get(HttpRouterRegistry);

    router.post('/add', (data: HttpBody<{ field1: string, field2: number }>) => {
        return data;
    });

    const httpKernel = test.app.get(HttpKernel);
    const response = await httpKernel.request(HttpRequest.POST('/add').json({ field1: 'foo', field2: 42 }));
    expect(response.text).toBe('Internal error');

    expect(test.getLogMessages().some(v => v.message.includes('options.maxFields (1) exceeded'))).toBe(true);
});
