/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import 'reflect-metadata';
import { FrameworkModule } from '@deepkit/framework';
import { BenchSuite } from '../bench.js';
import { Socket } from 'net';
import { AppModule, ServiceContainer } from '@deepkit/app';
import { http, HttpKernel, HttpRequest, HttpResponse } from '@deepkit/http';

export async function main() {
    const bench = new BenchSuite('http');
    let called = 0;

    class Controller {
        @http.GET()
        get() {
            called++;
            return 'hi';
        }
    }

    const app = new AppModule({
        controllers: [Controller],
        imports: [
            new FrameworkModule({ httpLog: false })
        ]
    });

    const serviceContainer = new ServiceContainer(app);
    const httpKernel = serviceContainer.getRootInjector().get(HttpKernel);

    // const logger = new Logger();
    //
    // const router = new Router(new HttpControllers([Controller]), logger);
    //
    // const context = InjectorContext.forProviders([
    //     {provide: Controller, scope: 'http'},
    //     HttpListener,
    //     {provide: Router, useValue: router},
    //     {provide: Logger, useValue: logger},
    // ]);
    // const dispatcher = new EventDispatcher(context);
    // dispatcher.registerListener(HttpListener);
    // const httpKernel = new HttpKernel(router, dispatcher, context, logger);

    const request = new (class extends HttpRequest {
        url = '/';
        method = 'GET';
    })(new Socket());

    const res = new HttpResponse(request);
    await httpKernel.handleRequest(request, res);

    // class MyClass {
    //     stopped = false;
    //
    //     stopPropagation() {
    //         this.stopped = true;
    //     }
    //
    //     isStopped() {
    //         return this.stopped;
    //     }
    // }
    //
    // bench.add('new BaseEvent', () => {
    //     new BaseEvent();
    //     new BaseEvent();
    //     new BaseEvent();
    // });
    //
    // bench.add('new MyClass', () => {
    //     new MyClass();
    //     new MyClass();
    //     new MyClass();
    // });
    //
    // bench.add('new workflowEVent', () => {
    //     new WorkflowEvent();
    //     new WorkflowEvent();
    //     new WorkflowEvent();
    // });
    //
    // bench.add('new HttpRequestEvent', () => {
    //     new HttpRequestEvent(undefined as any, undefined as any, undefined as any);
    //     new HttpRequestEvent(undefined as any, undefined as any, undefined as any);
    //     new HttpRequestEvent(undefined as any, undefined as any, undefined as any);
    // });
    //
    //
    // bench.add('new HttpWorkflowEventWithRoute', () => {
    //     new HttpWorkflowEventWithRoute(undefined as any, undefined as any, undefined as any, undefined as any, undefined as any);
    //     new HttpWorkflowEventWithRoute(undefined as any, undefined as any, undefined as any, undefined as any, undefined as any);
    //     new HttpWorkflowEventWithRoute(undefined as any, undefined as any, undefined as any, undefined as any, undefined as any);
    // });
    //
    // bench.run();

    bench.addAsync('http', async () => {
        const res = new HttpResponse(request);
        await httpKernel.handleRequest(request, res);
    });

    await bench.runAsync();
    console.log('called', called);
}
