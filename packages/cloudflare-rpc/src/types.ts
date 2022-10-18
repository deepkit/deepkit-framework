import type { App } from '@deepkit/app';

export interface FetchRequestHandlerOptions<M> {
    readonly app: App<M>;
    readonly request: Request;
}
