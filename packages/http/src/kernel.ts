import { InjectorContext } from '@deepkit/injector';
import { HttpRouter } from './router.js';
import { EventDispatcher } from '@deepkit/event';
import { LoggerInterface } from '@deepkit/logger';
import {
    HttpRequest,
    HttpResponse,
    incomingMessageToHttpRequest,
    MemoryHttpResponse,
    RequestBuilder,
    serverResponseToHttpResponse,
} from './model.js';
import { HttpError, HttpRequestEvent, HttpResultFormatter, httpWorkflow, JSONResponse } from './http.js';
import { FrameCategory, Stopwatch } from '@deepkit/stopwatch';
import { unlink } from 'fs';
import { ValidationError } from '@deepkit/type';
import { IncomingMessage, ServerResponse } from 'http';

export class HttpKernel {
    constructor(
        protected router: HttpRouter,
        protected eventDispatcher: EventDispatcher,
        protected injectorContext: InjectorContext,
        protected logger: LoggerInterface,
        protected stopwatch?: Stopwatch,
    ) {
    }

    /**
     * Creates a request handler function that can be used with http.createServer
     * or any other http server library based on the node.js http module.
     *
     * When `fallThroughOnNotFound` is set to true, the handler will call `next()`
     * when the route is not found, allowing the request to fall through to the next
     * middleware in the chain.
     *
     * @example
     * ```typescript
     * import { createServer } from 'http';
     *
     * const app = new App({
     *   imports: [new HttpModule({throwOnNotFound: true})],
     * });
     *
     * const handler = app.get(HttpKernel).createHandler(true);
     * const server = createServer(handler);
     *
     * server.listen(3000);
     * ```
     */
    public createHandler(fallThroughOnNotFound: boolean = false) {
        return (req: IncomingMessage, res: ServerResponse, next: (error?: any) => void) => {
            return this.handleRequest(req, res, fallThroughOnNotFound).then(() => {
                if (!res.headersSent) {
                    next()
                }
            }).catch((error) => {
                if (fallThroughOnNotFound && error instanceof HttpError && error.httpCode === 404) {
                    next();
                    return;
                }
                next(error);
            });
        };
    }

    public async request(requestBuilder: RequestBuilder, throwOnNotFound: boolean = false): Promise<MemoryHttpResponse> {
        const request = requestBuilder.build();
        const response = new MemoryHttpResponse(request);
        response.assignSocket(request.socket);
        await this.handleRequest(request, response, throwOnNotFound);
        return response;
    }

    async handleRequest(_req: IncomingMessage, _res: ServerResponse, throwOnNotFound: boolean = false) {
        const httpInjectorContext = this.injectorContext.createChildScope('http');
        const req = incomingMessageToHttpRequest(_req);
        const res = serverResponseToHttpResponse(_res);
        httpInjectorContext.set(HttpRequest, req);
        httpInjectorContext.set(HttpResponse, res);
        httpInjectorContext.set(InjectorContext, httpInjectorContext);
        req.throwErrorOnNotFound = throwOnNotFound;

        const frame = this.stopwatch ? this.stopwatch.start(req.method + ' ' + req.getUrl(), FrameCategory.http, true) : undefined;
        const workflow = httpWorkflow.create('start', this.eventDispatcher, httpInjectorContext, this.stopwatch);

        try {
            if (frame) {
                frame.data({ url: req.getUrl(), method: req.getMethod(), clientIp: req.getRemoteAddress() });
                await frame.run(() => workflow.apply('request', new HttpRequestEvent(httpInjectorContext, req, res)));
            } else {
                await workflow.apply('request', new HttpRequestEvent(httpInjectorContext, req, res));
            }
        } catch (error: any) {
            if (!res.headersSent) {
                const resultFormatter = httpInjectorContext.get(HttpResultFormatter);
                if (error instanceof ValidationError) {
                    resultFormatter.handle(new JSONResponse({
                        message: error.message,
                        errors: error.errors,
                    }, 400).disableAutoSerializing(), { request: req, response: res });
                    return;
                } else if (error instanceof HttpError) {
                    if (error.httpCode === 404) {
                        throw error;
                    }
                    resultFormatter.handle(new JSONResponse({
                        message: error.message,
                    }, error.httpCode).disableAutoSerializing(), { request: req, response: res });
                    return;
                }

                res.status(500);
            }

            this.logger.error('HTTP kernel request failed', error);
        } finally {
            for (const file of Object.values(req.uploadedFiles || [])) {
                unlink(file.path, () => {
                });
            }

            if (frame) {
                frame.data({ responseStatus: res.statusCode });
                frame.end();
            }
        }
    }
}
