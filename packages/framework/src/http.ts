/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType, CustomError } from '@deepkit/core';
import { getClassTypeFromInstance, isClassInstance, isRegisteredEntity, jsonSerializer } from '@deepkit/type';
import { stat } from 'fs';
import { ServerResponse } from 'http';
import { Socket } from 'net';
import { join } from 'path';
import serveStatic from 'serve-static';
import { HttpRequestDebugCollector } from './debug/debugger';
import { EventDispatcher, eventDispatcher } from './event';
import { HttpRequest, HttpResponse } from './http-model';
import { inject, injectable, InjectorContext, MemoryInjector } from './injector/injector';
import { kernelConfig } from './kernel.config';
import { Logger } from './logger';
import { RouteConfig, RouteParameterResolverForInjector, Router } from './router';
import { isElementStruct, render } from './template/template';
import { createWorkflow, WorkflowEvent } from './workflow';
import { Zone } from './zone';


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

export class HttpAccessDeniedError extends HttpError(403, 'Access denied') {
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

    clearNext() {
        this.nextState = undefined;
        this.nextStateEvent = undefined;
    }

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

    send(response: any) {
        this.next('response', new HttpResponseEvent(this.injectorContext, this.request, this.response, response));
    }
}

export const HttpRequestEvent = HttpWorkflowEvent;
export const HttpRouteNotFoundEvent = HttpWorkflowEvent;

export class HttpWorkflowEventWithRoute extends HttpWorkflowEvent {
    constructor(
        public injectorContext: InjectorContext,
        public request: HttpRequest,
        public response: HttpResponse,
        public route: RouteConfig,
    ) {
        super(injectorContext, request, response);
    }

    send(response: any) {
        this.next('response', new HttpResponseEvent(this.injectorContext, this.request, this.response, response, this.route));
    }
}

export class HttpRouteEvent extends HttpWorkflowEvent {
    constructor(
        public injectorContext: InjectorContext,
        public request: HttpRequest,
        public response: HttpResponse,
        public parameterResolver?: RouteParameterResolverForInjector,
        public route?: RouteConfig,
    ) {
        super(injectorContext, request, response);
    }

    routeFound(route: RouteConfig, parameterResolver: RouteParameterResolverForInjector) {
        this.route = route;
        this.next('auth', new HttpAuthEvent(this.injectorContext, this.request, this.response, this.route, parameterResolver));
    }

    notFound() {
        this.next('routeNotFound', new HttpRouteNotFoundEvent(this.injectorContext, this.request, this.response));
    }
}

export class HttpAuthEvent extends HttpWorkflowEventWithRoute {
    constructor(
        public injectorContext: InjectorContext,
        public request: HttpRequest,
        public response: HttpResponse,
        public route: RouteConfig,
        public parameterResolver: RouteParameterResolverForInjector,
    ) {
        super(injectorContext, request, response, route);
    }

    success() {
        this.next('resolveParameters', new HttpResolveParametersEvent(this.injectorContext, this.request, this.response, this.parameterResolver, this.route));
    }

    accessDenied() {
        this.next('accessDenied', new HttpAccessDeniedEvent(this.injectorContext, this.request, this.response, this.route));
    }
}

export class HttpAccessDeniedEvent extends HttpWorkflowEvent {
    constructor(
        public injectorContext: InjectorContext,
        public request: HttpRequest,
        public response: HttpResponse,
        public route: RouteConfig,
    ) {
        super(injectorContext, request, response);
    }
}

export class HttpResolveParametersEvent extends HttpWorkflowEvent {
    public parameters: any[] = [];

    constructor(
        public injectorContext: InjectorContext,
        public request: HttpRequest,
        public response: HttpResponse,
        public parameterResolver: RouteParameterResolverForInjector,
        public route: RouteConfig,
    ) {
        super(injectorContext, request, response);
    }
}

export class HttpControllerEvent extends HttpWorkflowEvent {
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

export class HttpResponseEvent extends WorkflowEvent {
    constructor(
        public injectorContext: InjectorContext,
        public request: HttpRequest,
        public response: HttpResponse,
        public result: any,
        public route?: RouteConfig,
    ) {
        super();
    }
}

export class HttpControllerErrorEvent extends HttpWorkflowEvent {
    constructor(
        public injectorContext: InjectorContext,
        public request: HttpRequest,
        public response: HttpResponse,
        public route: RouteConfig,
        public error: Error,
    ) {
        super(injectorContext, request, response);
    }
}

export const httpWorkflow = createWorkflow('http', {
    start: WorkflowEvent,
    request: HttpRequestEvent,
    route: HttpRouteEvent,
    routeNotFound: HttpRouteNotFoundEvent,
    auth: HttpAuthEvent,
    resolveParameters: HttpResolveParametersEvent,
    accessDenied: HttpAccessDeniedEvent,
    controller: HttpControllerEvent,
    controllerError: HttpControllerErrorEvent,
    response: HttpResponseEvent,
}, {
    start: 'request',
    request: 'route',
    route: ['auth', 'routeNotFound'],
    auth: ['resolveParameters', 'accessDenied'],
    resolveParameters: 'controller',
    controller: ['accessDenied', 'controllerError', 'response'],
    accessDenied: 'response',
    controllerError: 'response',
    routeNotFound: 'response',
});

export class HtmlResponse {
    constructor(public html: string, public statusCode?: number) {
    }
}

export class JSONResponse {
    constructor(public json: any, public statusCode?: number) {
    }
}

export function serveStaticListener(path: string): ClassType {
    @injectable()
    class HttpRequestStaticServingListener {
        protected serveStatic = serveStatic(path, { index: false });

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

        @eventDispatcher.listen(httpWorkflow.onRoute, 101) //after default route listener at 100
        onRoute(event: typeof httpWorkflow.onRoute.event) {
            if (event.sent) return;
            if (event.route) return;

            const localPath = join(path, join('/', event.url));

            return new Promise(resolve => {
                stat(localPath, (err, stat) => {
                    if (stat && stat.isFile()) {
                        event.routeFound(
                            new RouteConfig('static', 'GET', event.url, { controller: HttpRequestStaticServingListener, methodName: 'serve' }),
                            () => [path, event.request, event.response]
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

    @eventDispatcher.listen(httpWorkflow.onRequest, 100)
    onRequest(event: typeof httpWorkflow.onRequest.event): void {
        if (event.sent) return;
        if (event.hasNext()) return;

        event.next('route', new HttpRouteEvent(event.injectorContext, event.request, event.response,));
    }

    @eventDispatcher.listen(httpWorkflow.onRoute, 100)
    onRoute(event: typeof httpWorkflow.onRoute.event) {
        if (event.sent) return;
        if (event.hasNext()) return;

        const resolved = this.router.resolveRequest(event.request);
        if (resolved) {
            event.routeFound(resolved.routeConfig, resolved.parameters);
        }
    }

    @eventDispatcher.listen(httpWorkflow.onRoute, 1000)
    onRouteForward(event: typeof httpWorkflow.onRoute.event) {
        if (event.sent) return;
        if (event.hasNext()) return;

        if (!event.route) {
            event.next('routeNotFound', new HttpRouteNotFoundEvent(event.injectorContext, event.request, event.response));
        }
    }

    @eventDispatcher.listen(httpWorkflow.onRouteNotFound, 100)
    async routeNotFound(event: typeof httpWorkflow.onRouteNotFound.event): Promise<void> {
        if (event.sent) return;
        if (event.hasNext()) return;

        event.send(new HtmlResponse('Not found', 404));
    }

    @eventDispatcher.listen(httpWorkflow.onAuth, 100)
    onAuth(event: typeof httpWorkflow.onAuth.event): void {
        if (event.sent) return;
        if (event.hasNext()) return;

        event.next('resolveParameters', new HttpResolveParametersEvent(event.injectorContext, event.request, event.response, event.parameterResolver, event.route));
    }

    @eventDispatcher.listen(httpWorkflow.onResolveParameters, 100)
    async onResolveParameters(event: typeof httpWorkflow.onResolveParameters.event) {
        if (event.response.finished) return;
        // if (event.hasNext()) return;

        event.parameters = await event.parameterResolver(event.injectorContext);

        event.next('controller', new HttpControllerEvent(event.injectorContext, event.request, event.response, event.parameters, event.route));
    }

    @eventDispatcher.listen(httpWorkflow.onAccessDenied, 100)
    onAccessDenied(event: typeof httpWorkflow.onAccessDenied.event): void {
        if (event.sent) return;
        if (event.hasNext()) return;

        event.send(new HtmlResponse('Access denied', 403));
    }

    @eventDispatcher.listen(httpWorkflow.onController, 100)
    async onController(event: typeof httpWorkflow.onController.event) {
        if (event.sent) return;
        if (event.hasNext()) return;

        const controllerInstance = event.injectorContext.get(event.route.action.controller);
        try {
            const method = controllerInstance[event.route.action.methodName];
            event.next('response', new HttpResponseEvent(event.injectorContext, event.request, event.response, await method.apply(controllerInstance, event.parameters), event.route));
        } catch (error) {
            if (error instanceof HttpAccessDeniedError) {
                event.next('accessDenied', new HttpAccessDeniedEvent(event.injectorContext, event.request, event.response, event.route));
            } else {
                event.next('controllerError', new HttpControllerErrorEvent(event.injectorContext, event.request, event.response, event.route, error));
            }
        }
    }

    @eventDispatcher.listen(httpWorkflow.onControllerError, 100)
    onControllerError(event: typeof httpWorkflow.onControllerError.event): void {
        if (event.response.finished) return;
        if (event.sent) return;

        this.logger.error('Controller error', event.error);

        event.send(new HtmlResponse('Internal error', 500));
    }

    @eventDispatcher.listen(httpWorkflow.onResponse, 100)
    async onResponse(event: typeof httpWorkflow.onResponse.event) {
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
            if (response.statusCode) event.response.writeHead(response.statusCode);
            event.response.end(response.html);
        } else if (isElementStruct(response)) {
            event.response.setHeader('Content-Type', 'text/html; charset=utf-8');
            event.response.end(await render(event.injectorContext, response));
        } else if (isClassInstance(response) && isRegisteredEntity(getClassTypeFromInstance(response))) {
            event.response.setHeader('Content-Type', 'application/json; charset=utf-8');
            event.response.end(JSON.stringify(jsonSerializer.for(getClassTypeFromInstance(response)).serialize(response)));
        } else if (response instanceof Uint8Array) {
            event.response.end(response);
        } else if (response instanceof JSONResponse) {
            event.response.setHeader('Content-Type', 'application/json; charset=utf-8');
            if (response.statusCode) event.response.writeHead(response.statusCode);
            event.response.end(JSON.stringify(response.json));
        } else {
            event.response.setHeader('Content-Type', 'application/json; charset=utf-8');
            event.response.end(JSON.stringify(response));
        }
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
            { provide: HttpRequest, useValue: req },
            { provide: HttpResponse, useValue: res },
        ]));

        const collector = this.debug ? httpInjectorContext.get(HttpRequestDebugCollector) : undefined;

        const workflow = httpWorkflow.create('start', this.eventDispatcher, httpInjectorContext, collector);
        try {
            if (collector) {
                await collector.init();
                try {
                    collector.stopwatch.start('http');
                    await Zone.run({ collector: collector }, async () => {
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
