import { MiddlewareRegistry } from '@deepkit/app';
import { injectable } from '@deepkit/injector';
import { HttpRequest, HttpResponse } from './model';

@injectable()
export class MiddlewareResolver {
    protected resolver?: (request: HttpRequest, response: HttpResponse) => any;

    constructor(protected middlewareRegistry: MiddlewareRegistry) {
    }

    // buildResolver(eventToken: EventToken<any>): Middleware {
        // const middlewares = this.middlewareRegistry.getForEventToken(eventToken);
        //
        // //todo build function
        // return (req: IncomingMessage, res: ServerResponse, next: (err?: any) => void) => {
        //
        // };
    // }
}
