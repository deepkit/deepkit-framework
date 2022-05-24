import type { App } from '@deepkit/app';
import { HttpKernel, RequestBuilder } from '@deepkit/http';

export interface FetchRequestHandlerOptions<M> {
    readonly app: App<M>;
    readonly request: Request;
}

export async function fetchRequestHandler<M>({
                                                 request,
                                                 app,
                                             }: FetchRequestHandlerOptions<M>): Promise<Response> {
    const url = new URL(request.url);
    const builder = new RequestBuilder(url.pathname, request.method).headers(
        Object.fromEntries(request.headers),
    );

    if (url.search !== '') {
        builder.queryPath = url.search.substring(1);
    }

    // TODO: FormData
    const contentType = request.headers.get('Content-Type');
    if (contentType === 'application/json') {
        builder.json(await request.json());
    } else if (contentType === 'text/plain') {
        builder.body(await request.text());
    }

    const result = await app.get(HttpKernel).request(builder);
    const response = new Response(result.body, {
        status: result.statusCode,
        statusText: result.statusMessage,
    });

    for (const [key, value] of Object.entries(result.getHeaders())) {
        if (typeof value === 'undefined') continue;

        if (typeof value === 'string') {
            response.headers.set(key, value);
            continue;
        }

        if (typeof value === 'number') {
            response.headers.set(key, value.toString());
            continue;
        }

        for (const v of value) {
            response.headers.append(key, v);
        }
    }

    return response;
}
