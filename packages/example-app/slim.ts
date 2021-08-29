import { App } from '@deepkit/app';
import { http, HttpKernel, HttpModule, HttpRequest, HttpResponse } from '@deepkit/http';
import { Server } from 'http';

class MyController {
    @http.GET()
    hello() {
        return 'hello world';
    }
}

const app = new App({
    controllers: [MyController],
    imports: [new HttpModule]
});

const httpKernel = app.get(HttpKernel);

new Server(
    { IncomingMessage: HttpRequest, ServerResponse: HttpResponse, },
    ((req, res) => {
        httpKernel.handleRequest(req as HttpRequest, res as HttpResponse);
    })
).listen(8080, () => {
    console.log('listen at 8080');
});

