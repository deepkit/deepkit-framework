import { InjectorContext } from '@deepkit/injector';
import { HttpRouter } from './router.js';
import { EventDispatcher } from '@deepkit/event';
import { LoggerInterface } from '@deepkit/logger';
import { HttpRequest, HttpResponse, MemoryHttpResponse, RequestBuilder } from './model.js';
import { HttpError, HttpRequestEvent, HttpResultFormatter, httpWorkflow, JSONResponse } from './http.js';
import { FrameCategory, Stopwatch } from '@deepkit/stopwatch';
import { unlink } from 'fs';
import { ValidationError } from '@deepkit/type';

export class HttpKernel {
    constructor(
        protected router: HttpRouter,
        protected eventDispatcher: EventDispatcher,
        protected injectorContext: InjectorContext,
        protected logger: LoggerInterface,
        protected stopwatch?: Stopwatch,
    ) {

    }

    public async request(requestBuilder: RequestBuilder): Promise<MemoryHttpResponse> {
        const request = requestBuilder.build();
        const response = new MemoryHttpResponse(request);
        response.assignSocket(request.socket);
        await this.handleRequest(request, response);
        return response;
    }

    async handleRequest(req: HttpRequest, res: HttpResponse) {
        const httpInjectorContext = this.injectorContext.createChildScope('http');
        httpInjectorContext.set(HttpRequest, req);
        httpInjectorContext.set(HttpResponse, res);
        httpInjectorContext.set(InjectorContext, httpInjectorContext);

        const frame = this.stopwatch ? this.stopwatch.start(req.method + ' ' + req.getUrl(), FrameCategory.http, true) : undefined;
        const workflow = httpWorkflow.create('start', this.eventDispatcher, httpInjectorContext, this.stopwatch);

        try {
            if (frame) {
                frame.data({ url: req.getUrl(), method: req.getMethod(), clientIp: req.getRemoteAddress() });
                await frame.run({}, () => workflow.apply('request', new HttpRequestEvent(httpInjectorContext, req, res)));
            } else {
                await workflow.apply('request', new HttpRequestEvent(httpInjectorContext, req, res));
            }
        } catch (error: any) {
            if (!res.headersSent) {

                const resultFormatter = httpInjectorContext.get(HttpResultFormatter);
                if (error instanceof ValidationError) {
                    resultFormatter.handle(new JSONResponse({
                        message: error.message,
                        errors: error.errors
                    }, 400).disableAutoSerializing(), { request: req, response: res });
                    return;
                } else if (error instanceof HttpError) {
                    resultFormatter.handle(new JSONResponse({
                        message: error.message
                    }, error.httpCode).disableAutoSerializing(), { request: req, response: res });
                    return;
                }

                res.status(500);
            }

            this.logger.error('HTTP kernel request failed', error);
        } finally {
            for (const file of Object.values(req.uploadedFiles)) {
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
