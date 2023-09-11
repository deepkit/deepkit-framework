import { App } from '@deepkit/app';
import { expect, test } from '@jest/globals';
import { HttpModule } from '../src/lib/module.js';
import { HttpKernel } from '../src/lib/kernel.js';
import { HttpRequest } from '../src/lib/model.js';
import { http } from '../src/lib/decorator.js';
import { httpWorkflow } from '../src/lib/http.js';

test('module basic functionality', async () => {
    class Controller {
        @http.GET('hello')
        hello() {
            return 'hi';
        }
    }

    const app = new App({
        controllers: [
            Controller,
        ],
        imports: [
            new HttpModule()
        ]
    });

    const httpKernel = app.get(HttpKernel);

    {
        const response = await httpKernel.request(HttpRequest.GET('/hello'));
        expect(response.statusCode).toBe(200);
        expect(response.json).toContain('hi');
    }
});

test('functional listener', async () => {
    class Controller {
        @http.GET('/hello/:name')
        hello(name: string) {
            return name;
        }
    }

    const gotUrls: string[] = [];
    const app = new App({
        controllers: [
            Controller,
        ],
        listeners: [
            httpWorkflow.onController.listen(event => {
                gotUrls.push(event.request.url || '');
            }),
        ],
        imports: [
            new HttpModule(),
        ]
    });

    const httpKernel = app.get(HttpKernel);

    {
        const response = await httpKernel.request(HttpRequest.GET('/hello/peter'));
        expect(response.statusCode).toBe(200);
        expect(response.json).toBe('peter');
        expect(gotUrls).toEqual(['/hello/peter']);
    }

    {
        const response = await httpKernel.request(HttpRequest.GET('/hello/marie'));
        expect(response.statusCode).toBe(200);
        expect(response.json).toBe('marie');
        expect(gotUrls).toEqual(['/hello/peter', '/hello/marie']);
    }
});
