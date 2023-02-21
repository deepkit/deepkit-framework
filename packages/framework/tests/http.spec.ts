import { App } from '@deepkit/app';
import { FrameworkModule } from '../src/module.js';
import { expect, test } from '@jest/globals';
import { HttpKernel, HttpRequest, HttpRouterRegistry } from '@deepkit/http';
import { Logger } from '@deepkit/logger';

test('functional http app', async () => {
    const app = new App({
        imports: [new FrameworkModule()]
    });

    const router = app.get(HttpRouterRegistry);

    router.get('/greet/:name', (name: string, logger: Logger) => {
        logger.log(`${name} was greeted`);
        return `Greetings ${name}`;
    });

    const httpKernel = app.get(HttpKernel);
    const response = await httpKernel.request(HttpRequest.GET('/greet/Peter'));
    expect(response.json).toBe('Greetings Peter');
});
