/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { AngularNodeAppEngine, createNodeRequestHandler, isMainModule, NodeRequestHandlerFunction, writeResponseToNodeResponse } from '@angular/ssr/node';
import { HttpKernel, HttpNotFoundError, HttpRequest, HttpResponse, httpWorkflow, RouteConfig, staticOnRoute } from '@deepkit/http';
import { eventDispatcher } from '@deepkit/event';
import { createModuleClass } from '@deepkit/app';
import { ApplicationServer } from '@deepkit/framework';
import { Logger } from '@deepkit/logger';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

class AngularConfig {
    /**
     * This can be set map HTTP_TRANSFER_CACHE_ORIGIN_MAP
     * via `REQUEST_CONTEXT`.
     *
     * @see REQUEST_CONTEXT
     */
    publicBaseUrl: string = '';

    /**
     * This is the base URL in the server, which is used in the server context
     * for SSR. This is auto-detected when not set.
     *
     * @see REQUEST_CONTEXT
     */
    serverBaseUrl: string = '';

    /**
     * Value of `import.meta.url` in the main entry point module (usually app.ts/server.ts).
     */
    moduleUrl: string = '';
}

/**
 * This object is available angular providers as DI token `REQUEST_CONTEXT`.
 */
class AngularRequestContext {
    serverBaseUrl: string = '';
    publicBaseUrl: string = '';

    constructor(config: AngularConfig) {
        this.serverBaseUrl = config.serverBaseUrl;
        this.publicBaseUrl = config.publicBaseUrl;
    }
}

class AngularState {
    ngApp: AngularNodeAppEngine = new AngularNodeAppEngine();
}

class AngularListener {
    constructor(
        public requestContext: AngularRequestContext,
        public state: AngularState,
    ) {
    }

    @eventDispatcher.listen(httpWorkflow.onRoute, 102)  //102 after 101=static listener, 100=default listener
    async onRoute(event: typeof httpWorkflow.onRoute.event) {
        if (event.route) return; //already found

        const promise = this.state.ngApp.handle(event.request, this.requestContext);
        if (!promise) return;

        event.routeFound(new RouteConfig('angular', ['GET'], event.request.url || '', {
            type: 'function',
            fn: async (req: HttpRequest, res: HttpResponse) => {
                const response = await promise;
                if (!response) {
                    throw new HttpNotFoundError();
                }
                await writeResponseToNodeResponse(response, res);
            },
        }), () => ({
            arguments: [event.request, event.response],
            parameters: {},
        }));
    }
}

class AngularStaticListener {
    public localPath: string = '';
    public path: string = '/'; //public path

    constructor(
        protected config: AngularConfig,
    ) {
        this.localPath = resolve(dirname(fileURLToPath(this.config.moduleUrl)), '../browser');
    }

    @eventDispatcher.listen(httpWorkflow.onRoute, 101) //after default route listener at 100
    onRoute(event: typeof httpWorkflow.onRoute.event) {
        if (event.sent) return;
        if (event.route) return;
        if (!this.localPath) return;
        return staticOnRoute(event, this.path, this.localPath);
    }
}

/**
 * This creates a request handler function for the Angular SSR server.
 * It also starts ApplicationServer of Deepkit Framework to serve HTTP/RPC requests.
 *
 * ```typescript
 * import { app } from './app';
 * import { RequestHandler } from '@deepkit/angular-ssr';
 *
 * export const reqHandler = app.get(RequestHandler).create(import.meta.url);
 * ```
 */
export class RequestHandler {
    protected started: boolean = false;

    constructor(
        protected config: AngularConfig,
        protected logger: Logger,
        protected requestContext: AngularRequestContext,
        protected http: HttpKernel,
        protected server: ApplicationServer,
    ) {
    }

    create(): NodeRequestHandlerFunction {
        const global = ((globalThis as any).deepkitAngular ||= {}) as {
            server?: ApplicationServer,
            started?: boolean,
        };

        const waitForClose = global.server ? global.server.close() : Promise.resolve();
        const mainModule = isMainModule(this.config.moduleUrl);

        // We only listen for process signals in the main module.
        const listenOnSignals = mainModule;
        global.server = this.server;

        const waitBootstrap = waitForClose.then(() => this.server.start({
            listenOnSignals,
            // startHttpServer: false,
        })).then(() => {
            let host = this.server.getHttpHost();
            if (host?.startsWith('0.0.0.0')) {
                host = 'localhost' + host.substr(7);
            }
            this.requestContext.serverBaseUrl = `http://${host}`;

            if (!this.requestContext.publicBaseUrl) {
                if (mainModule) {
                    this.requestContext.publicBaseUrl = 'http://localhost:8080';
                } else {
                    //angular dev server
                    this.requestContext.publicBaseUrl = 'http://localhost:4200';
                }
            }
        });

        waitBootstrap.then(() => {
            if (!global.started) {
                this.logger.log('Angular SSR server bootstrap done, using REQUEST_CONTEXT', this.requestContext);
                global.started = true;
            }
        });

        const handler = this.http.createMiddleware();

        // every request in angular dev server is handled by this function
        return createNodeRequestHandler(async (req, res, next) => {
            await waitBootstrap;

            // if req wants to upgrade to websocket, we need to handle this here
            if (req.headers.upgrade === 'websocket') {
                return;
            }

            try {
                await handler(req, res, next);
            } catch (error) {
                this.logger.log('createNodeRequestHandler error', error);
            }
        });
    }
}

export class AngularModule extends createModuleClass({
    name: 'angular',
    config: AngularConfig,
    providers: [
        RequestHandler,
        AngularRequestContext,
        AngularStaticListener,
        AngularState,
    ],
    exports: [
        RequestHandler,
        AngularRequestContext,
        AngularStaticListener,
        AngularState,
    ],
    listeners: [
        AngularListener,
        AngularStaticListener,
    ],
}) {
}
