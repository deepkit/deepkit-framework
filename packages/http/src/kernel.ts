import { inject, injectable, InjectorContext } from '@deepkit/injector';
import { Router } from './router';
import { EventDispatcher } from '@deepkit/event';
import { Logger } from '@deepkit/logger';
import { HttpRequest, HttpResponse, MemoryHttpResponse, RequestBuilder } from './model';
import { HttpRequestEvent, httpWorkflow } from './http';
import { FrameCategory, Stopwatch } from '@deepkit/stopwatch';
import { unlink } from 'fs';

@injectable
export class HttpKernel {
    constructor(
        protected router: Router,
        protected eventDispatcher: EventDispatcher,
        protected injectorContext: InjectorContext,
        protected logger: Logger,
        @inject().optional protected stopwatch?: Stopwatch,
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
        httpInjectorContext.get(HttpRequest);

        const frame = this.stopwatch ? this.stopwatch.start(req.method + ' ' + req.getUrl(), FrameCategory.http, true) : undefined;
        const workflow = httpWorkflow.create('start', this.eventDispatcher, httpInjectorContext, this.stopwatch);

        try {
            if (frame) {
                frame.data({ url: req.getUrl(), method: req.getMethod(), clientIp: req.getRemoteAddress() });
                await frame.run({}, () => workflow.apply('request', new HttpRequestEvent(httpInjectorContext, req, res)));
            } else {
                await workflow.apply('request', new HttpRequestEvent(httpInjectorContext, req, res));
            }
        } catch (error) {
            if (!res.headersSent) res.status(500);

            this.logger.error('HTTP kernel request failed', error);
        } finally {
            for (const file of Object.values(req.uploadedFiles)) {
                unlink(file.path, () => {
                });
            }

            frame?.data({ responseStatus: res.statusCode });
            frame?.end();
        }
    }
}
