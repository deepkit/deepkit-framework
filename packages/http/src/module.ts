import { HttpListener, HttpResultFormatter, httpWorkflow } from './http.js';
import { HttpConfig } from './module.config.js';
import { AppModule, createModule } from '@deepkit/app';
import { HttpRouter, HttpRouterRegistry } from './router.js';
import { HttpKernel } from './kernel.js';
import { HttpRouterFilterResolver } from './filter.js';
import { HttpControllers } from './controllers.js';
import { ConsoleTransport, Logger } from '@deepkit/logger';
import { HttpRequest, HttpResponse } from './model.js';
import '@deepkit/type';
import { ClassType } from '@deepkit/core';
import { httpClass } from './decorator.js';

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
        { provide: Logger, useValue: new Logger([new ConsoleTransport()]) },
    ],
    listeners: [
        HttpListener,
    ],
    workflows: [
        httpWorkflow
    ],
    exports: [
        HttpRouter,
        HttpRouterRegistry,
        HttpKernel,
        HttpResultFormatter,
        HttpRouterFilterResolver,
        HttpResponse,
        HttpRequest,
        HttpControllers,
        Logger,
    ]
}) {
    protected httpControllers = new HttpControllers;

    process() {
        this.addProvider({ provide: HttpControllers, useValue: this.httpControllers });
    }

    processController(module: AppModule<any>, controller: ClassType) {
        const httpConfig = httpClass._fetch(controller);
        if (!httpConfig) return;

        if (!module.isProvided(controller)) module.addProvider({ provide: controller, scope: 'http' });
        this.httpControllers.add(controller, module);
    }
}
