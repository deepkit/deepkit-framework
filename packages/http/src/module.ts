import { HttpListener, HttpResultFormatter, httpWorkflow } from './http';
import { config } from './module.config';
import { AppModule, createModule } from '@deepkit/app';
import { Router } from './router';
import { HttpKernel } from './kernel';
import { HttpRouterFilterResolver } from './filter';
import { HttpControllers } from './controllers';
import { ConsoleTransport, Logger } from '@deepkit/logger';
import { HttpRequest, HttpResponse } from './model';
import '@deepkit/type';
import { ClassType } from '@deepkit/core';
import { httpClass } from './decorator';

export class HttpModule extends createModule({
    config: config,
    providers: [
        Router,
        HttpKernel,
        HttpResultFormatter,
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
        Logger
    ]
}) {
    root = true;
    protected httpControllers = new HttpControllers;

    process() {
        this.addProvider({ provide: HttpControllers, useValue: this.httpControllers });
    }

    handleControllers(module: AppModule<any>, controllers: ClassType[]) {
        for (const controller of controllers) {
            const httpConfig = httpClass._fetch(controller);
            if (!httpConfig) return;

            if (!module.isProvided(controller)) module.addProvider({ provide: controller, scope: 'http' });
            this.httpControllers.add(controller, module);
        }
    }
}
