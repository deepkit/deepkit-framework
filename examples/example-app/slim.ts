import { App } from '@deepkit/app';
import { http, HttpKernel, HttpModule, HttpRequest, HttpResponse } from '@deepkit/http';
import { Server } from 'http';

class MyService {
    helloWorld () {
        return 'Hello World'
    }
}

class MyController {
    constructor(private myService: MyService) {
    }
    @http.GET()
    hello(response: HttpResponse) {
        response.end(this.myService.helloWorld());
    }
}

const app = new App({
    providers: [MyService, MyController],
    controllers: [MyController],
    imports: [new HttpModule]
});

const httpKernel = app.get(HttpKernel);

new Server(
    { IncomingMessage: HttpRequest, ServerResponse: HttpResponse as any, },
    ((req, res) => {
        httpKernel.handleRequest(req as HttpRequest, res as HttpResponse);
    })
).listen(8080, () => {
    console.log('listen at 8080');
});

