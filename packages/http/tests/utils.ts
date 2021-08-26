import { ClassType, isClass } from '@deepkit/core';
import { ProviderWithScope } from '@deepkit/injector';
import { HttpKernel } from '../src/kernel';
import { App, AppModule, MiddlewareFactory } from '@deepkit/app';
import { HttpModule } from '../src/module';

export function createHttpKernel(
    controllers: (ClassType | { module: AppModule<any>, controller: ClassType })[],
    providers: ProviderWithScope[] = [],
    listeners: ClassType[] = [],
    middlewares: MiddlewareFactory[] = [],
    modules: AppModule<any>[] = []
) {
    const imports: AppModule<any>[] = modules.slice(0);
    imports.push(new HttpModule());

    for (const controller of controllers) {
        if (isClass(controller)) continue;
        imports.push(controller.module);
    }

    const module = new AppModule({
        controllers: controllers.map(v => isClass(v) ? v : v.controller),
        imports,
        providers,
        listeners,
        middlewares,
    });

    const app = new App({imports: [module]});
    return app.get(HttpKernel);
}
