import { App } from '@deepkit/app';
import { expect, test } from '@jest/globals';
import { ApiConsoleModule } from '../src/module';
import { HttpKernel, HttpModule, HttpRequest } from '@deepkit/http';

test('module basic functionality', async () => {
    const app = new App({
        imports: [
            new ApiConsoleModule({path: '/my-api'}),
            new HttpModule()
        ]
    });

    const http = app.get(HttpKernel);

    {
        const response = await http.request(HttpRequest.GET('/my-api'))
        expect(response.statusCode).toBe(200);
        expect(response.bodyString).toContain('/my-api');
    }
});
