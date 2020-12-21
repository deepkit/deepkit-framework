/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import {RouteConfig, Router} from './router';
import {ClassType, CustomError, isPromise} from '@deepkit/core';
import {inject, injectable, InjectorContext, MemoryInjector} from './injector/injector';
import {IncomingMessage, ServerResponse} from 'http';
import {Socket} from 'net';
import {getClassTypeFromInstance, isClassInstance, isRegisteredEntity, jsonSerializer} from '@deepkit/type';
import {isElementStruct, render} from './template/template';
import {Logger} from './logger';
import serveStatic from 'serve-static';
import {BaseEvent, EventDispatcher, eventDispatcher,} from './event';
import {createWorkflow, WorkflowEvent} from './workflow';
import {join} from 'path';
import {stat} from 'fs';
import {HttpRequestDebugCollector} from './debug/debugger';
import {kernelConfig} from './kernel.config';
import {Zone} from './zone';
import {HttpRequest, HttpResponse} from './http-model';


export class Redirect {
    public routeName?: string;
    public routeParameters?: { [name: string]: any };
    public url?: string;

    constructor(
        public statusCode: number = 302,
    ) {
    }

    static toRoute(routeName: string, parameters: { [name: string]: any } = {}, statusCode: number = 302): Redirect {
        const redirect = new Redirect(statusCode);
        redirect.routeName = routeName;
        redirect.routeParameters = parameters;
        return redirect;
    }

    static toUrl(url: string, statusCode: number = 302): Redirect {
        const redirect = new Redirect(statusCode);
        redirect.url = url;
        return redirect;
    }
}

export interface HttpError<T> {
    new(...args: any[]): Error;

    getHttpCode(): T;
}

export function HttpError<T extends number>(code: T, defaultMessage: string = ''): HttpError<T> {
    return class extends CustomError {
        constructor(message: string = defaultMessage) {
            super(message);
        }

        static getHttpCode() {
            return code;
        }
    };
}

export class HttpNotFoundError extends HttpError(404, 'Not found') {
}

export class HttpBadRequestError extends HttpError(400, 'Bad request') {
}

export class HttpWorkflowEvent {
    stopped = false;

    stopPropagation() {
        this.stopped = true;
    }

    isStopped() {
        return this.stopped;
    }

    public nextState?: any;
    public nextStateEvent?: any;

    /**
     * @see WorkflowNextEvent.next
     */
    next(nextState: string, event?: any) {
        this.nextState = nextState;
        this.nextStateEvent = event;
    }

    hasNext(): boolean {
        return this.nextState !== undefined;
    }

    constructor(
        public injectorContext: InjectorContext,
        public request: HttpRequest,
        public response: HttpResponse,
    ) {
    }

    get url() {
        return this.request.url || '/';
    }

    /**
     * Whether a response has already been sent.
     */
    get sent() {
        return this.response.headersSent;
    }
}
export const HttpRequestEvent = HttpWorkflowEvent;
export const HttpResponseEvent = HttpWorkflowEvent;
export const HttpRouteNotFoundEvent = HttpWorkflowEvent;

export class HttpWorkflowEventWithRoute extends HttpWorkflowEvent {
    constructor(
        public injectorContext: InjectorContext,
        public request: HttpRequest,
        public response: HttpResponse,
        public parameters: any[] = [],
        public route: RouteConfig,
    ) {
        super(injectorContext, request, response);
    }
}

export class HttpRouteEvent extends HttpWorkflowEvent {
    constructor(
        public injectorContext: InjectorContext,
        public request: HttpRequest,
        public response: HttpResponse,
        public parameters: any[] = [],
        public route?: RouteConfig,
    ) {
        super(injectorContext, request, response);
    }

    routeFound(route: RouteConfig, parameters?: any[]) {
        this.route = route;
        if (parameters) this.parameters = parameters;
        this.next('auth', new HttpAuthEvent(this.injectorContext, this.request, this.response, this.parameters, this.route));
    }

    notFound() {
        this.next('routeNotFound', new HttpRouteNotFoundEvent(this.injectorContext, this.request, this.response));
    }
}

export class HttpAuthEvent extends HttpWorkflowEventWithRoute {
    accessDenied = false;
}

export class HttpAccessDeniedEvent extends HttpWorkflowEventWithRoute {
    accessDenied = false;
}

export class HttpControllerEvent extends HttpWorkflowEventWithRoute {
    controllerResponse(response: any) {
        this.next('controllerResponse', new HttpControllerResponseEvent(this.injectorContext, this.request, this.response, this.parameters, this.route, response));
    }

    controllerError(error: Error) {
        this.next('controllerError', new HttpControllerErrorEvent(this.injectorContext, this.request, this.response, this.parameters, this.route, error));
    }
}

export class HttpControllerResponseEvent extends WorkflowEvent {
    constructor(
        public injectorContext: InjectorContext,
        public request: HttpRequest,
        public response: HttpResponse,
        public parameters: any[],
        public route: RouteConfig,
        public result: any,
    ) {
        super();
    }
}

export class HttpControllerErrorEvent extends WorkflowEvent {
    constructor(
        public injectorContext: InjectorContext,
        public request: HttpRequest,
        public response: HttpResponse,
        public parameters: any[],
        public route: RouteConfig,
        public error: Error,
    ) {
        super();
    }
}

export const httpWorkflow = createWorkflow('http', {
    start: WorkflowEvent,
    request: HttpRequestEvent,
    route: HttpRouteEvent,
    routeNotFound: HttpRouteNotFoundEvent,
    auth: HttpAuthEvent,
    accessDenied: HttpAccessDeniedEvent,
    controller: HttpControllerEvent,
    controllerResponse: HttpControllerResponseEvent,
    controllerError: HttpControllerErrorEvent,
    response: HttpResponseEvent,
}, {
    start: 'request',
    request: 'route',
    route: ['auth', 'routeNotFound'],
    auth: ['controller', 'accessDenied'],
    controller: ['accessDenied', 'controllerResponse', 'controllerError'],
    accessDenied: 'response',
    controllerResponse: 'response',
    controllerError: 'response',
    routeNotFound: 'response',
});

export class HtmlResponse {
    constructor(public html: string) {
    }
}

export class JSONResponse {
    constructor(public json: any) {
    }
}

export function serveStaticListener(path: string): ClassType {
    @injectable()
    class HttpRequestStaticServingListener {
        protected serveStatic = serveStatic(path, {index: false});

        serve(path: string, request: HttpRequest, response: HttpResponse) {
            return new Promise(resolve => {
                response.once('finish', () => {
                    resolve(undefined);
                });
                this.serveStatic(request, response, () => {
                    resolve(response);
                });
            });
        }

        @eventDispatcher.listen(httpWorkflow.onRoute, 1) //after default route listener at 0.5
        onRoute(event: typeof httpWorkflow.onRoute.event) {
            if (event.sent) return;
            if (event.route) return;

            const localPath = join(path, join('/', event.url));

            return new Promise(resolve => {
                stat(localPath, (err, stat) => {
                    if (stat && stat.isFile()) {
                        event.routeFound(
                            new RouteConfig('angular', 'GET', event.url, {controller: HttpRequestStaticServingListener, methodName: 'serve'}),
                            [path, event.request, event.response]
                        );
                    }
                    resolve(undefined);
                });
            });
        }
    }

    return HttpRequestStaticServingListener;
}


@injectable()
export class HttpListener {
    constructor(
        protected router: Router,
        protected logger: Logger,
    ) {
    }

    @eventDispatcher.listen(httpWorkflow.onRoute)
    async onRoute(event: typeof httpWorkflow.onRoute.event) {
        if (event.response.finished) return;
        if (event.hasNext()) return;

        const resolved = this.router.resolveRequest(event.request);

        if (!resolved) {
            event.notFound();
        } else {
            event.routeFound(resolved.routeConfig, resolved.parameters ? await resolved.parameters(event.injectorContext) : []);
        }
    }

    @eventDispatcher.listen(httpWorkflow.onRouteNotFound)
    async routeNotFound(event: typeof httpWorkflow.onRouteNotFound.event): Promise<void> {
        if (event.response.finished) return;
        event.response.writeHead(404);
        event.response.end('Not found.');
        event.next('response', new HttpResponseEvent(event.injectorContext, event.request, event.response));
    }

    @eventDispatcher.listen(httpWorkflow.onAuth)
    onAuth(event: typeof httpWorkflow.onAuth.event): void {
        if (event.hasNext()) return;
        if (event.accessDenied) {
            event.next('accessDenied', new HttpAccessDeniedEvent(event.injectorContext, event.request, event.response, event.parameters, event.route));
        } else {
            event.next('controller', new HttpControllerEvent(event.injectorContext, event.request, event.response, event.parameters, event.route));
        }
    }

    @eventDispatcher.listen(httpWorkflow.onAccessDenied)
    onAccessDenied(event: typeof httpWorkflow.onAccessDenied.event): void {
        if (event.hasNext()) return;
        if (event.response.finished) return;
        event.response.writeHead(403);
        event.response.end('Access denied');
        event.next('response', new HttpResponseEvent(event.injectorContext, event.request, event.response));
    }

    @eventDispatcher.listen(httpWorkflow.onController)
    async onController(event: typeof httpWorkflow.onController.event) {
        if (event.hasNext()) return;
        if (event.response.finished) return;

        const controllerInstance = event.injectorContext.get(event.route.action.controller);
        try {
            const method = controllerInstance[event.route.action.methodName];
            event.controllerResponse(await method.apply(controllerInstance, event.parameters));
        } catch (error) {
            event.controllerError(error);
        }
    }

    @eventDispatcher.listen(httpWorkflow.onControllerError)
    onControllerError(event: typeof httpWorkflow.onControllerError.event): void {
        if (event.response.finished) return;
        this.logger.error('Controller error', event.error);
        event.response.writeHead(500);
        event.response.end('Internal error');
        event.next('response', new HttpResponseEvent(event.injectorContext, event.request, event.response));
    }

    @eventDispatcher.listen(httpWorkflow.onControllerResponse)
    async onControllerResponse(event: typeof httpWorkflow.onControllerResponse.event) {
        const response = event.result;

        if (response === null || response === undefined) {
            event.response.end(response);
        } else if ('string' === typeof response) {
            event.response.end(response);
        } else if (response instanceof Redirect) {
            if (response.routeName) {
                event.response.writeHead(response.statusCode, {
                    Location: this.router.resolveUrl(response.routeName, response.routeParameters)
                });
            } else {
                event.response.writeHead(response.statusCode, {
                    Location: response.url
                });
            }
            event.response.end();
        } else if (response instanceof ServerResponse) {
        } else if (response instanceof HtmlResponse) {
            event.response.setHeader('Content-Type', 'text/html; charset=utf-8');
            event.response.end(response.html);
        } else if (isElementStruct(response)) {
            event.response.setHeader('Content-Type', 'text/html; charset=utf-8');
            event.response.end(await render(event.injectorContext, response));
        } else if (isClassInstance(response) && isRegisteredEntity(getClassTypeFromInstance(response))) {
            event.response.setHeader('Content-Type', 'application/json; charset=utf-8');
            event.response.end(JSON.stringify(jsonSerializer.for(getClassTypeFromInstance(response)).serialize(response)));
        } else if (response instanceof Buffer) {
            event.response.end(response);
        } else if (response instanceof JSONResponse) {
            event.response.setHeader('Content-Type', 'application/json; charset=utf-8');
            event.response.end(JSON.stringify(response.json));
        } else {
            event.response.setHeader('Content-Type', 'application/json; charset=utf-8');
            event.response.end(JSON.stringify(response));
        }
        event.next('response', new HttpResponseEvent(event.injectorContext, event.request, event.response));
    }

    @eventDispatcher.listen(httpWorkflow.onRequest)
    onRequest(event: typeof httpWorkflow.onRequest.event): void {
        if (event.response.finished) return;
        event.next('route', new HttpRouteEvent(event.injectorContext, event.request, event.response));
    }
}

@injectable()
export class HttpKernel {
    constructor(
        protected router: Router,
        protected eventDispatcher: EventDispatcher,
        protected injectorContext: InjectorContext,
        protected logger: Logger,
        @inject(kernelConfig.token('debug')) protected debug: boolean = false,
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
            console.error('Could not parse JSON:' + result);
            return undefined;
        }
    }

    async handleRequest(req: HttpRequest, res: HttpResponse) {
        const httpInjectorContext = this.injectorContext.createChildScope('http', new MemoryInjector([
            {provide: HttpRequest, useValue: req},
            {provide: HttpResponse, useValue: res},
        ]));

        const collector = this.debug ? httpInjectorContext.get(HttpRequestDebugCollector) : undefined;

        const workflow = httpWorkflow.create('start', this.eventDispatcher, httpInjectorContext, collector);
        try {
            if (collector) {
                await collector.init();
                try {
                    collector.stopwatch.start('http');
                    await Zone.run({collector: collector}, async () => {
                        await workflow.apply('request', new HttpRequestEvent(httpInjectorContext, req, res));
                    });
                    collector.stopwatch.end('http');
                } finally {
                    await collector.save();
                }
            } else {
                await workflow.apply('request', new HttpRequestEvent(httpInjectorContext, req, res));
            }
        } catch (error) {
            this.logger.log('HTTP kernel request failed', error);
            throw error;
        }
    }
}
