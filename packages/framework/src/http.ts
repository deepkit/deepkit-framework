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

import {Router} from './router';
import {ClassType, CustomError, getClassName} from '@deepkit/core';
import {injectable, MemoryInjector} from './injector/injector';
import {IncomingMessage, ServerResponse} from 'http';
import {Socket} from 'net';
import {InjectorContext} from './injector/injector';
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

export const httpWorkflow = createWorkflow('http', {
    start: WorkflowEvent,
    request: HttpRequestEvent,
    route: WorkflowEvent,
    routeNotFound: HttpRouteNotFoundEvent,
    auth: WorkflowEvent,
    accessDenied: WorkflowEvent,
    controller: WorkflowEvent,
    controllerResponse: WorkflowEvent,
    controllerException: WorkflowEvent,
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
httpWorkflow.addTransition('controller', 'controllerException');

httpWorkflow.addTransition('controllerResponse', 'response');
httpWorkflow.addTransition('controllerException', 'response');
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

        @eventDispatcher.listen(httpWorkflow.onRequest, -1)
        async onRequest(event: typeof httpWorkflow.onRequest.event) {
            // await asyncOperation(resolve => {
            //     this.serveStatic(event.request, event.response, () => {
            //         resolve(undefined);
            //     });
            // });
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

    }

    @eventDispatcher.listen(httpWorkflow.onRouteNotFound)
    async routeNotFound(event: typeof httpWorkflow.onRouteNotFound.event): Promise<void> {
        event.next('routeNotFound', new HttpRouteNotFoundEvent(event.request, event.response));
    }

    @eventDispatcher.listen(httpWorkflow.onAuth)
    async onAuth(event: typeof httpWorkflow.onAuth.event): Promise<void> {

    }

    @eventDispatcher.listen(httpWorkflow.onAccessDenied)
    async onAccessDenied(event: typeof httpWorkflow.onAccessDenied.event): Promise<void> {

    }

    @eventDispatcher.listen(httpWorkflow.onController)
    async onController(event: typeof httpWorkflow.onController.event): Promise<void> {

    }

    @eventDispatcher.listen(httpWorkflow.onControllerException)
    async onControllerException(event: typeof httpWorkflow.onControllerException.event): Promise<void> {

    }

    @eventDispatcher.listen(httpWorkflow.onControllerResponse)
    async onControllerResponse(event: typeof httpWorkflow.onControllerResponse.event): Promise<void> {

    }

    @eventDispatcher.listen(httpWorkflow.onRequest)
    async onRequest( event: typeof httpWorkflow.onRequest.event): Promise<void> {
        if (event.response.finished) return;

        const resolved = await this.router.resolveRequest(event.request);

        if (!resolved) {
            event.next('routeNotFound', new HttpRouteNotFoundEvent(event.request, event.response));
            return;
        }

        const controllerInstance = this.scopedContext.get(resolved.routeConfig.action.controller);

        // event.response.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8'});
        // event.response.end('Early exit');

        try {
            const args = resolved.parameters(this.scopedContext);
            const method = controllerInstance[resolved.routeConfig.action.methodName];
            let response = method.apply(controllerInstance, args);
            if (response instanceof Promise) response = await response;

            if (response === null || response === undefined) {
                event.response.writeHead(200, {
                    'Content-Type': 'text/html; charset=utf-8'
                });
                event.response.end(response);
            } else if ('string' === typeof response) {
                event.response.writeHead(200, {
                    'Content-Type': 'text/plain; charset=utf-8'
                });
                event.response.end(response);
            } else if (response instanceof ServerResponse) {
                return;
            } else if (response instanceof HtmlResponse) {
                event.response.writeHead(200, {
                    'Content-Type': 'text/html; charset=utf-8'
                });
                event.response.end(response.html);
            } else if (isElementStruct(response)) {
                event.response.writeHead(200, {
                    'Content-Type': 'text/html; charset=utf-8'
                });
                event.response.end(await render(this.scopedContext, response));
            } else if (isClassInstance(response) && isRegisteredEntity(getClassTypeFromInstance(response))) {
                event.response.writeHead(200, {
                    'Content-Type': 'application/json; charset=utf-8'
                });
                event.response.end(JSON.stringify(jsonSerializer.for(getClassTypeFromInstance(response)).serialize(response)));
            } else if (response instanceof Buffer) {
                event.response.writeHead(200, {
                });
                event.response.end(response);
            } else if (response instanceof JSONResponse) {
                event.response.writeHead(200, {
                    'Content-Type': 'application/json; charset=utf-8'
                });
                event.response.end(JSON.stringify(response.json));
            } else {
                event.response.writeHead(200, {
                    'Content-Type': 'application/json; charset=utf-8'
                });
                event.response.end(JSON.stringify(response));
            }
        } catch (error) {
            this.logger.error(`Server error, controller action ${getClassName(resolved.routeConfig.action.controller)}.${resolved.routeConfig.action.methodName}`, error);
            event.response.writeHead(500, {
                'Content-Type': 'text/plain; charset=utf-8'
            });
            event.response.end('Server error');
        }
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

    handleRequest(req: IncomingMessage, res: ServerResponse) {
        const httpScopedContext = this.scopedContext.createChildScope('http', new MemoryInjector([
            {provide: IncomingMessage, useValue: req},
            {provide: ServerResponse, useValue: res},
        ]));
        const eventDispatcher = this.eventDispatcher.for(httpScopedContext);

        const httpRequestEvent = new HttpRequestEvent(req, res);

        const workflow = httpWorkflow.create('start', eventDispatcher);

        // const httpListener = httpScopedContext.get(HttpListener);
        // httpListener.onRequest(httpRequestEvent);

        return workflow.apply('request', httpRequestEvent);
    }
}
