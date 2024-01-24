import { AddedListener, AppModule, ControllerConfig, createModule, stringifyListener } from '@deepkit/app';
import { EventToken } from '@deepkit/event';
import { InjectorContext } from '@deepkit/injector';
import { ConsoleTransport, Logger } from '@deepkit/logger';
import '@deepkit/type';
import { ReflectionKind, ReflectionParameter, Type, metaAnnotation } from '@deepkit/type';

import { HttpControllers } from './controllers.js';
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
        metaAnnotation.getForName(parameter.type, 'httpQueries') ||
            metaAnnotation.getForName(parameter.type, 'httpQuery') ||
            metaAnnotation.getForName(parameter.type, 'httpBody') ||
            metaAnnotation.getForName(parameter.type, 'httpPath') ||
            metaAnnotation.getForName(parameter.type, 'httpHeader'),
    );
}

export class HttpModule extends createModule({
    config: HttpConfig,
    providers: [
        HttpRouter,
        HttpKernel,
        HttpResultFormatter,
        HttpRouterRegistry,
        HttpRouterFilterResolver,
        { provide: HttpResponse, scope: 'http' },
        { provide: HttpRequest, scope: 'http' },
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
            if (metaAnnotation.getForName(parameter.type, 'httpBody')) needsAsync = true;
            if (parameterRequiresRequest(parameter)) requiresHttpRequest = true;
        }

        if (needsAsync) {
            //not yet supported since we have to patch the listener to be async and redirect the call (as the DI container is sync).
            throw new Error(
                `Listener ${stringifyListener(listener)} requires async HttpBody. This is not yet supported. You have to parse the request manually by injecting HttpRequest.`,
            );
        }

        for (let index = 0; index < params.length; index++) {
            const parameter = params[index];
            if (!parameterRequiresRequest(parameter)) continue;

            //change the reflection type so that we create a unique injection token for that type.
            const unique = Symbol('unique');
            const uniqueType: Type = { kind: ReflectionKind.literal, literal: unique };
            metaAnnotation.registerType(parameter.type, { name: 'inject', options: [uniqueType] });
            let build: Function;
            let i = index;

            this.addProvider({
                provide: uniqueType,
                useFactory: (
                    httpConfig: HttpConfig,
                    request: HttpRequest,
                    injector: InjectorContext,
                    config?: RouteConfig,
                ) => {
                    if (!build) {
                        const params = listener.reflection.getParameters().slice(1);
                        build = buildRequestParser(httpConfig.parser, params, config?.getFullPath());
                    }

                    const parser = build(request);
                    const params = parser(injector);
                    return params.arguments[i];
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
