import { App, RootModuleDefinition } from '@deepkit/app';

import { HttpRouterRegistry } from './router.js';

/**
 * Same as App, but with easily accessible router to make the most common use case easier.
 */
export class HttpApp<T extends RootModuleDefinition> extends App<T> {
    get router(): HttpRouterRegistry {
        return super.get(HttpRouterRegistry);
    }
}
