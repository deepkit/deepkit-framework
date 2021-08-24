import { ClassType, isClass } from '@deepkit/core';
import { InjectorContext, ProviderWithScope, TagProvider, TagRegistry } from '@deepkit/injector';
import { Router } from '../src/router';
import { HttpListener, HttpResultFormatter } from '../src/http';
import { ConsoleTransport, Logger } from '@deepkit/logger';
import { EventDispatcher } from '@deepkit/event';
import { HttpKernel } from '../src/kernel';
import { AppModule, MiddlewareFactory, MiddlewareRegistry } from '@deepkit/app';

export function createHttpKernel(
    controllers: (ClassType | {module: AppModule<any, any>, controller: ClassType})[],
    providers: ProviderWithScope[] = [],
    listeners: ClassType[] = [],
    middlewares: MiddlewareFactory[] = [],
    modules: AppModule<any, any>[] = []
) {
    const tagProviders = new TagRegistry();
    for (const provider of providers.slice(0)) {
        if (provider instanceof TagProvider) {
            providers.unshift(provider.provider);
            tagProviders.tags.push(provider);
        }
    }
    const middlewareRegistry = new MiddlewareRegistry();
    const module = new AppModule({});

    for (const middleware of middlewares) {
        const config = middleware();
        middlewareRegistry.configs.push({ module, config });
    }
    const router = Router.forControllers(controllers.map(v => {
        return isClass(v) ? {module, controller: v} : v;
    }), tagProviders, middlewareRegistry);

    const injector = InjectorContext.forProviders([
        { provide: Router, useValue: router },
        ...controllers.map(v => isClass(v) ? v : v.controller),
        ...providers,
        ...listeners,
        HttpListener,
        HttpResultFormatter,
        { provide: Logger, useValue: new Logger([new ConsoleTransport()]) }
    ], module);
    for (const m of modules) {
        const context = injector.registerModule(m);
        context.providers.push(...m.options.providers || []);
    }
    const eventDispatcher = new EventDispatcher(injector);
    eventDispatcher.registerListener(HttpListener);
    for (const listener of listeners) eventDispatcher.registerListener(listener);
    return new HttpKernel(router, eventDispatcher, injector, new Logger([new ConsoleTransport()]));
}
