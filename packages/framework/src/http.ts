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
import {ClassType, CustomError} from '@deepkit/core';
import {injectable, InjectorContext, MemoryInjector} from './injector/injector';
import {IncomingMessage, ServerResponse} from 'http';
import {Socket} from 'net';
import {getClassTypeFromInstance, isClassInstance, isRegisteredEntity, jsonSerializer} from '@deepkit/type';
import {isElementStruct, render} from './template/template';
import {Logger} from './logger';
import * as serveStatic from 'serve-static';
import {EventDispatcher, eventDispatcher,} from './event';
import {createWorkflow, WorkflowEvent} from './workflow';

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

export class HttpRequestEvent extends WorkflowEvent {
    constructor(
        public readonly request: IncomingMessage,
        public readonly response: ServerResponse,
    ) {
        super();
    }
}

export class HttpResponseEvent extends WorkflowEvent {
    constructor(
        public readonly request: IncomingMessage,
        public readonly response: ServerResponse,
    ) {
        super();
    }
}

export class HttpRouteNotFoundEvent extends WorkflowEvent {
    constructor(
        public readonly request: IncomingMessage,
        public readonly response: ServerResponse,
    ) {
        super();
    }
}

export class HttpRouteEvent extends WorkflowEvent {
    constructor(
        public readonly request: IncomingMessage,
        public readonly response: ServerResponse,
        public parameters: any[] = [],
        public route?: RouteConfig,
    ) {
        super();
    }
}

export class HttpAuthEvent extends WorkflowEvent {
    accessDenied = false;

    constructor(
        public readonly request: IncomingMessage,
        public readonly response: ServerResponse,
        public parameters: any[],
        public route: RouteConfig,
    ) {
        super();
    }
}

export class HttpAccessDeniedEvent extends WorkflowEvent {
    accessDenied = false;

    constructor(
        public readonly request: IncomingMessage,
        public readonly response: ServerResponse,
        public parameters: any[],
        public route: RouteConfig,
    ) {
        super();
    }
}

export class HttpControllerEvent extends WorkflowEvent {
    constructor(
        public readonly request: IncomingMessage,
        public readonly response: ServerResponse,
        public parameters: any[],
        public route: RouteConfig,
    ) {
        super();
    }
}

export class HttpControllerResponseEvent extends WorkflowEvent {
    constructor(
        public readonly request: IncomingMessage,
        public readonly response: ServerResponse,
        public parameters: any[],
        public route: RouteConfig,
        public result: any,
    ) {
        super();
    }
}

export class HttpControllerErrorEvent extends WorkflowEvent {
    constructor(
        public readonly request: IncomingMessage,
        public readonly response: ServerResponse,
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
    static: WorkflowEvent,
    response: HttpResponseEvent,
});

httpWorkflow.addTransition('start', 'request');
httpWorkflow.addTransition('request', 'route');

httpWorkflow.addTransition('route', 'auth');
httpWorkflow.addTransition('route', 'routeNotFound');
httpWorkflow.addTransition('routeNotFound', 'static');

httpWorkflow.addTransition('auth', 'controller');
httpWorkflow.addTransition('auth', 'accessDenied');

httpWorkflow.addTransition('controller', 'controllerResponse');
httpWorkflow.addTransition('controller', 'controllerError');

httpWorkflow.addTransition('accessDenied', 'response');
httpWorkflow.addTransition('controllerResponse', 'response');
httpWorkflow.addTransition('controllerError', 'response');
httpWorkflow.addTransition('static', 'response');


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

        @eventDispatcher.listen(httpWorkflow.onRouteNotFound, -1)
        onRouteNotFound(event: typeof httpWorkflow.onRouteNotFound.event) {
            if (event.response.finished) return;

            return new Promise(resolve => {
                this.serveStatic(event.request, event.response, () => {
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
        protected scopedContext: InjectorContext,
        protected logger: Logger,
    ) {
    }

    @eventDispatcher.listen(httpWorkflow.onRoute)
    async onRoute(event: typeof httpWorkflow.onRoute.event): Promise<void> {
        if (event.response.finished) return;
        if (event.hasNext()) return;

        const resolved = await this.router.resolveRequest(event.request);

        if (!resolved) {
            event.next('routeNotFound', new HttpRouteNotFoundEvent(event.request, event.response));
        } else {
            event.next('auth', new HttpAuthEvent(event.request, event.response, resolved.parameters(this.scopedContext), resolved.routeConfig));
        }
    }

    @eventDispatcher.listen(httpWorkflow.onRouteNotFound)
    async routeNotFound(event: typeof httpWorkflow.onRouteNotFound.event): Promise<void> {
        if (event.response.finished) return;
        event.response.writeHead(404);
        event.response.end('Not found.');
    }

    @eventDispatcher.listen(httpWorkflow.onAuth)
    onAuth(event: typeof httpWorkflow.onAuth.event): void {
        if (event.hasNext()) return;
        if (event.accessDenied) {
            event.next('accessDenied', new HttpAccessDeniedEvent(event.request, event.response, event.parameters, event.route));
        } else {
            event.next('controller', new HttpControllerEvent(event.request, event.response, event.parameters, event.route));
        }
    }

    @eventDispatcher.listen(httpWorkflow.onAccessDenied)
    onAccessDenied(event: typeof httpWorkflow.onAccessDenied.event): void {
        if (event.hasNext()) return;
        if (event.response.finished) return;
        event.response.writeHead(403);
        event.response.end('Access denied');
    }

    @eventDispatcher.listen(httpWorkflow.onController)
    async onController(event: typeof httpWorkflow.onController.event): Promise<void> {
        if (event.hasNext()) return;
        if (event.response.finished) return;

        const controllerInstance = this.scopedContext.get(event.route.action.controller);
        const method = controllerInstance[event.route.action.methodName];
        let result = method.apply(controllerInstance, event.parameters);
        if (result instanceof Promise) result = await result;
        event.next('controllerResponse', new HttpControllerResponseEvent(event.request, event.response, event.parameters, event.route, result));
    }

    @eventDispatcher.listen(httpWorkflow.onControllerError)
    onControllerException(event: typeof httpWorkflow.onControllerError.event): void {
        if (event.response.finished) return;
        event.response.writeHead(500);
        event.response.end('Internal error');
    }

    @eventDispatcher.listen(httpWorkflow.onControllerResponse)
    async onControllerResponse(event: typeof httpWorkflow.onControllerResponse.event) {
        const response = event.result;

        if (response === null || response === undefined) {
            event.response.setHeader('Content-Type', 'text/plain; charset=utf-8');
            event.response.end(response);
        } else if ('string' === typeof response) {
            event.response.end(response);
        } else if (response instanceof ServerResponse) {
            return;
        } else if (response instanceof HtmlResponse) {
            event.response.setHeader('Content-Type', 'text/html; charset=utf-8');
            event.response.end(response.html);
        } else if (isElementStruct(response)) {
            event.response.setHeader('Content-Type', 'text/html; charset=utf-8');
            event.response.end(await render(this.scopedContext, response));
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
    }

    @eventDispatcher.listen(httpWorkflow.onRequest)
    onRequest(event: typeof httpWorkflow.onRequest.event): void {
        if (event.response.finished) return;
        event.next('route', new HttpRouteEvent(event.request, event.response));
    }
}

@injectable()
export class HttpKernel {
    constructor(
        protected router: Router,
        protected eventDispatcher: EventDispatcher,
        protected scopedContext: InjectorContext,
        protected logger: Logger,
    ) {
    }

    async handleRequestFor(method: string, url: string, jsonBody?: any): Promise<any> {
        const body = Buffer.from(jsonBody ? JSON.stringify(jsonBody) : '');

        const request = new (class extends IncomingMessage {
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
        const response = new (class extends ServerResponse {
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

    async handleRequest(req: IncomingMessage, res: ServerResponse) {
        const httpScopedContext = this.scopedContext.createChildScope('http', new MemoryInjector([
            {provide: IncomingMessage, useValue: req},
            {provide: ServerResponse, useValue: res},
        ]));

        const workflow = httpWorkflow.create('start', this.eventDispatcher, httpScopedContext);
        return workflow.apply('request', new HttpRequestEvent(req, res));
    }
}
