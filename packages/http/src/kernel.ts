import { injectable, InjectorContext, MemoryInjector } from '@deepkit/injector';
import { Router } from './router';
import { EventDispatcher } from '@deepkit/event';
import { Logger } from '@deepkit/logger';
import { HttpRequest, HttpResponse } from './model';
import { Socket } from 'net';
import { HttpRequestEvent, httpWorkflow } from './http';
import { FrameCategory, Stopwatch } from '@deepkit/stopwatch';
import { unlink } from 'fs';

@injectable()
export class HttpKernel {
    constructor(
        protected router: Router,
        protected eventDispatcher: EventDispatcher,
        protected injectorContext: InjectorContext,
        protected logger: Logger,
        protected stopwatch: Stopwatch,
    ) {

    }

    async handleRequestFor(method: string, url: string, jsonBody?: any): Promise<any> {
        const body = Buffer.from(jsonBody ? JSON.stringify(jsonBody) : '');

        const request = new (class extends HttpRequest {
            url = url;
            method = method;
            position = 0;

            headers = {
                'content-type': 'application/json',
                'content-length': String(body.byteLength),
            };

            done = false;

            _read(size: number) {
                if (this.done) {
                    this.push(null);
                } else {
                    this.push(body);
                    this.done = true;
                }
            }
        })(new Socket());

        let result: any = 'nothing';
        const response = new (class extends HttpResponse {
            end(chunk: any) {
                result = chunk ? chunk.toString() : chunk;
            }

            write(chunk: any): boolean {
                result = chunk ? chunk.toString() : chunk;
                return true;
            }
        })(request);

        await this.handleRequest(request, response);
        if (result === '' || result === undefined || result === null) return result;
        try {
            return JSON.parse(result);
        } catch (error) {
            return result;
        }
    }

    async handleRequest(req: HttpRequest, res: HttpResponse) {
        const httpInjectorContext = this.injectorContext.createChildScope('http', new MemoryInjector([
            { provide: HttpRequest, useValue: req },
            { provide: HttpResponse, useValue: res },
        ]));

        const frame = this.stopwatch.active ? this.stopwatch.start(req.getUrl(), FrameCategory.http, true) : undefined;
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
