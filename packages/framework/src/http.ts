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
import {asyncOperation, ClassType, CustomError, getClassName} from '@deepkit/core';
import {injectable, Injector} from './injector/injector';
import {IncomingMessage, ServerResponse} from 'http';
import {Socket} from 'net';
import {Context, EventDispatcher, ServiceContainer} from './service-container';
import {Provider} from './injector/provider';
import {getClassTypeFromInstance, isClassInstance, isRegisteredEntity, jsonSerializer} from '@deepkit/type';
import {isElementStruct, render} from './template/template';
import {ApplicationConfig} from './application-config';
import {Logger} from './logger';
import {BaseEvent, eventDispatcher, EventOfEventToken, EventToken} from './decorator';
import * as serveStatic from 'serve-static';

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

export function serveStaticListener(path: string): ClassType {
    @injectable()
    class HttpRequestStaticServingListener {
        protected serveStatic = serveStatic(path);

        @eventDispatcher.listen(onHttpRequest, -1)
        onHttpRequest(event: EventOfEventToken<typeof onHttpRequest>) {
            return asyncOperation(resolve => {
                this.serveStatic(event.request, event.response, () => {
                    resolve(undefined);
                });
            });
        }
    }

    return HttpRequestStaticServingListener;
}

export class HttpNotFoundError extends HttpError(404, 'Not found') {
}

export class HttpBadRequestError extends HttpError(400, 'Bad request') {
}

export class HttpRequestEvent extends BaseEvent {
    constructor(
        public readonly request: IncomingMessage,
        public readonly response: ServerResponse,
    ) {
        super();
    }
}

export const onHttpRequest = new EventToken<HttpRequestEvent>('http.request');

export class HttpRouteNotFoundEvent extends BaseEvent {
    constructor(
        public readonly request: IncomingMessage,
        public readonly response: ServerResponse,
    ) {
        super();
    }
}

export const onHttpRouteNotFound = new EventToken<HttpRouteNotFoundEvent>('http.route.notFound');

export class HtmlResponse {
    constructor(public html: string) {
    }
}

@injectable()
export class HttpRouteListener {
    protected httpRouteNotFoundEventCaller = this.eventListenerContainer.getCaller(onHttpRouteNotFound);

    constructor(
        protected router: Router,
        protected middlewareContainer: EventDispatcher,
        protected eventListenerContainer: EventDispatcher,
        protected config: ApplicationConfig,
        protected logger: Logger,
    ) {
    }

    protected createInjector(classType: ClassType, providers: Provider[] = []) {
        const context = (classType as any)[ServiceContainer.contextSymbol] as Context;
        if (!context) {
            throw new Error(`Controller ${getClassName(classType)} has no injector context assigned.`);
        }

        return new Injector(providers, [context.getInjector(), context.getRequestInjector().fork()]);
    }

    @eventDispatcher.listen(onHttpRequest)
    async http(event: EventOfEventToken<typeof onHttpRequest>): Promise<void> {
        if (event.response.finished) return;

        const resolved = await this.router.resolveRequest(event.request);

        if (!resolved) {
            await this.httpRouteNotFoundEventCaller(new HttpRouteNotFoundEvent(event.request, event.response));
            return;
        }

        const injector = this.createInjector(resolved.routeConfig.action.controller, [
            {provide: IncomingMessage, useValue: event.request},
            {provide: ServerResponse, useValue: event.response},
        ]);
        injector.allowUnknown = true;

        const controllerInstance = injector.get(resolved.routeConfig.action.controller);
        try {
            const response = await controllerInstance[resolved.routeConfig.action.methodName](...resolved.parameters(injector));

            if (response === null || response === undefined) {
                event.response.writeHead(200, {
                    'Content-Type': 'text/html; charset=utf-8'
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
                event.response.end(await render(injector, response));
            } else if (isClassInstance(response) && isRegisteredEntity(getClassTypeFromInstance(response))) {
                event.response.writeHead(200, {
                    'Content-Type': 'application/json; charset=utf-8'
                });
                event.response.end(JSON.stringify(jsonSerializer.for(getClassTypeFromInstance(response)).serialize(response)));
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
    protected httpRequestEventCaller = this.eventListenerContainer.getCaller(onHttpRequest);

    constructor(
        protected router: Router,
        protected eventListenerContainer: EventDispatcher,
        protected config: ApplicationConfig,
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

        let result: any = {};
        const response = new (class extends ServerResponse {
            end(chunk: any) {
                result = chunk.toString();
            }

            write(chunk: any): boolean {
                result = chunk.toString();
                return true;
            }
        })(request);

        await this.handleRequest(request, response);
        try {
            return JSON.parse(result);
        } catch (error) {
            console.error('Could not parse JSON:' + result);
            return undefined;
        }
    }

    async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const httpRequestEvent = new HttpRequestEvent(req, res);
        await this.httpRequestEventCaller(httpRequestEvent);
    }
}
