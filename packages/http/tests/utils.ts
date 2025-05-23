import { ClassType, isArray, isClass, isFunction } from '@deepkit/core';
import { ProviderWithScope } from '@deepkit/injector';
import { HttpKernel } from '../src/kernel.js';
import { App, AppModule, MiddlewareFactory } from '@deepkit/app';
import { EventListener } from '@deepkit/event';
import { HttpModule } from '../src/module.js';
import { HttpRouterRegistry } from '../src/router.js';
import { HttpConfig } from '../src/module.config.js';

export function createHttpKernel(
    controllers: (ClassType | { module: AppModule<any>, controller: ClassType })[] | ((registry: HttpRouterRegistry) => void) = [],
    providers: ProviderWithScope[] = [],
    listeners: (EventListener | ClassType)[] = [],
    middlewares: MiddlewareFactory[] = [],
    modules: AppModule<any>[] = [],
    config?: HttpConfig
) {
    const app = createHttpApp(controllers, providers, listeners, middlewares, modules, config);

    return app.get(HttpKernel);
}

export function createHttpApp(
    controllers: (ClassType | { module: AppModule<any>, controller: ClassType })[] | ((registry: HttpRouterRegistry) => void) = [],
    providers: ProviderWithScope[] = [],
    listeners: (EventListener | ClassType)[] = [],
    middlewares: MiddlewareFactory[] = [],
    modules: AppModule<any>[] = [],
    config: HttpConfig = new HttpConfig()
) {
    const imports: AppModule<any>[] = modules.slice(0);
    imports.push(new HttpModule().configure(config));

    if (isArray(controllers)) {
        for (const controller of controllers) {
            if (isClass(controller)) continue;
            if (isFunction(controller)) continue;
            imports.push(controller.module);
        }
    }

    const module = new AppModule({}, {
        controllers: isArray(controllers) ? controllers.map(v => isClass(v) ? v : v.controller) : [],
        imports,
        providers,
        listeners,
        middlewares,
    });

    const app = App.fromModule(module);

    if (!isArray(controllers)) {
        const registry = app.get(HttpRouterRegistry);
        controllers(registry);
    }

    return app;
}
