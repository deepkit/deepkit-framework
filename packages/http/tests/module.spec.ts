import { App } from '@deepkit/app';
import { expect, test } from '@jest/globals';
import { HttpModule } from '../src/module';
import { HttpKernel } from '../src/kernel';
import { HttpRequest } from '../src/model';
import { http } from '../src/decorator';

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
