import { App } from '@deepkit/app';
import { http, HttpKernel, HttpModule, HttpRequest, HttpResponse } from '@deepkit/http';
import { Server } from 'http';
import { injectable } from '@deepkit/injector';
import { getClassSchema, t } from '@deepkit/type';

class MyService {
    helloWorld () {
        return 'Hello World'
    }
}

class Entity {
    @t tags: string[] = [];
}

const schema = getClassSchema(Entity);
console.log('schema read', schema.toString());

@injectable
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
    { IncomingMessage: HttpRequest, ServerResponse: HttpResponse, },
    ((req, res) => {
        httpKernel.handleRequest(req as HttpRequest, res as HttpResponse);
    })
).listen(8080, () => {
    console.log('listen at 8080');
});

