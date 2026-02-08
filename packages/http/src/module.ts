import { AddedListener, AppModule, ControllerConfig, createModuleClass, stringifyListener } from '@deepkit/app';
import { DeepkitError } from '@deepkit/core';
import { EventToken } from '@deepkit/event';
import { InjectorContext } from '@deepkit/injector';
import { ConsoleTransport, Logger } from '@deepkit/logger';
import '@deepkit/type';
import { ReflectionKind, ReflectionParameter, Type, typeAnnotation } from '@deepkit/type';

import { HttpControllers } from './controllers.js';
import { CorsListener } from './cors.js';
import { httpClass } from './decorator.js';
import { HttpRouterFilterResolver } from './filter.js';
import { HttpListener, HttpResultFormatter, httpWorkflow } from './http.js';
import { HttpKernel } from './kernel.js';
import { HttpRequest, HttpResponse } from './model.js';
import { HttpConfig } from './module.config.js';
import { buildRequestParser } from './request-parser.js';
import { HttpRouter, HttpRouterRegistry, RouteConfig } from './router.js';

function parameterRequiresRequest(parameter: ReflectionParameter): boolean {
    return Boolean(
        typeAnnotation.getType(parameter.type, 'httpQueries') ||
            typeAnnotation.getType(parameter.type, 'httpQuery') ||
            typeAnnotation.getType(parameter.type, 'httpBody') ||
            typeAnnotation.getType(parameter.type, 'httpRequestParser') ||
            typeAnnotation.getType(parameter.type, 'httpPath') ||
            typeAnnotation.getType(parameter.type, 'httpHeader'),
    );
}

export class HttpModule extends createModuleClass({
    config: HttpConfig,
    providers: [
        HttpRouter,
        HttpKernel,
        HttpResultFormatter,
        HttpRouterRegistry,
        HttpRouterFilterResolver,
        { provide: InjectorContext, useValue: undefined, scope: 'http' },
        { provide: HttpResponse, useValue: undefined, scope: 'http' },
        { provide: HttpRequest, useValue: undefined, scope: 'http' },
        { provide: RouteConfig, useValue: undefined, scope: 'http' },
        { provide: Logger, useValue: new Logger([new ConsoleTransport()]) },
    ],
    listeners: [HttpListener],
    workflows: [httpWorkflow],
    exports: [
        HttpRouter,
        HttpRouterRegistry,
        HttpKernel,
        HttpResultFormatter,
        HttpRouterFilterResolver,
        InjectorContext,
        HttpResponse,
        HttpRequest,
        HttpControllers,
        RouteConfig,
        Logger,
    ],
}) {
    protected httpControllers = new HttpControllers();

    process() {
        this.addProvider({ provide: HttpControllers, useValue: this.httpControllers });

        // Register CORS listener if configured
        if (this.config.cors) {
            this.addListener(CorsListener);
        }
    }

    protected patchEventsForHttpRequestAccess: EventToken<any>[] = [
        httpWorkflow.onRequest,
        httpWorkflow.onAuth,
        httpWorkflow.onController,
    ];

    processListener(module: AppModule<any>, listener: AddedListener) {
        if (!this.patchEventsForHttpRequestAccess.includes(listener.eventToken)) return;

        let requiresHttpRequest = false;
        let needsAsync = false;
        const params = listener.reflection.getParameters().slice(1);

        for (const parameter of params) {
            if (typeAnnotation.getType(parameter.type, 'httpBody')) needsAsync = true;
            if (parameterRequiresRequest(parameter)) requiresHttpRequest = true;
        }

        if (needsAsync) {
            //not yet supported since we have to patch the listener to be async and redirect the call (as the DI container is sync).
            throw new DeepkitError(
                'DK-H002',
                `Listener ${stringifyListener(listener)} requires async HttpBody. This is not yet supported. You have to parse the request manually by injecting HttpRequest.`,
            );
        }

        const parserCache = new Map<RouteConfig, Function>();

        for (let index = 0; index < params.length; index++) {
            const parameter = params[index];
            if (!parameterRequiresRequest(parameter)) continue;

            //change the reflection type so that we create a unique injection token for that type.
            const unique = Symbol('event.parameter:' + parameter.name);
            const uniqueType: Type = { kind: ReflectionKind.literal, literal: unique };
            typeAnnotation.registerType(parameter.type, { name: 'inject', options: uniqueType });
            let i = index;

            this.addProvider({
                provide: uniqueType,
                useFactory: (
                    httpConfig: HttpConfig,
                    request: HttpRequest,
                    injector: InjectorContext,
                    config?: RouteConfig,
                ) => {
                    let build = config && parserCache.get(config);
                    if (!build) {
                        const params = listener.reflection.getParameters().slice(1);
                        build = buildRequestParser(httpConfig.parser, params, config);
                        if (config) parserCache.set(config, build);
                    }

                    const parser = build(request);
                    const result = parser(injector);
                    return result.arguments[i];
                },
                scope: 'http',
            });
            this.addExport(uniqueType);
        }
    }

    processController(module: AppModule<any>, config: ControllerConfig) {
        const controller = config.controller;
        if (!controller) return;

        const httpConfig = httpClass._fetch(controller);
        if (!httpConfig) return;

        if (!module.isProvided(controller)) module.addProvider({ provide: controller, scope: 'http' });
        this.httpControllers.add(controller, module);
    }
}
