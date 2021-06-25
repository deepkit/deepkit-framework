/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { http } from './decorator';
import { join } from 'path';
import { readFileSync, stat } from 'fs';
import { HtmlResponse, httpWorkflow } from './http';
import { AppModule } from '@deepkit/app';
import { normalizeDirectory } from './utils';
import { ClassType, urlJoin } from '@deepkit/core';
import { injectable } from '@deepkit/injector';
import { HttpRequest, HttpResponse } from './model';
import send from 'send';
import { eventDispatcher } from '@deepkit/event';
import { RouteConfig } from './router';

export function serveStaticListener(path: string, localPath: string = path): ClassType {
    @injectable()
    class HttpRequestStaticServingListener {
        serve(path: string, request: HttpRequest, response: HttpResponse) {
            return new Promise(resolve => {
                const res = send(request, path, { root: localPath })
                response.once('finish', resolve);
                res.pipe(response);
            });
        }

        @eventDispatcher.listen(httpWorkflow.onRoute, 101) //after default route listener at 100
        onRoute(event: typeof httpWorkflow.onRoute.event) {
            if (event.sent) return;
            if (event.route) return;

            if (!event.request.url?.startsWith(path)) return;

            const relativePath = urlJoin('/', event.url.substr(path.length));
            const finalLocalPath = join(localPath, relativePath);

            return new Promise(resolve => {
                stat(finalLocalPath, (err, stat) => {
                    if (stat && stat.isFile()) {
                        event.routeFound(
                            new RouteConfig('static', 'GET', event.url, {
                                controller: HttpRequestStaticServingListener,
                                methodName: 'serve'
                            }),
                            () => [relativePath, event.request, event.response]
                        );
                    }
                    resolve(undefined);
                });
            });
        }
    }

    return HttpRequestStaticServingListener;
}

function loadHtml(localPath: string, path: string): string {
    try {
        let indexHtml = readFileSync(join(localPath, 'index.html')).toString('utf8');
        indexHtml = indexHtml.replace('<base href="/">', `<base href="${path}">`);
        return indexHtml;
    } catch (error) {
        return '';
    }
}

/**
 * Serves files from a local directory at `path`. All paths without . are redirected to
 * ${localPath}/index.html.
 */
export function registerStaticHttpController(module: AppModule<any, any>, path: string, localPath: string): void {
    path = normalizeDirectory(path);
    let indexHtml = '';

    @http.controller(path)
    class StaticController {
        @http.GET(':any').regexp('any', '[^\.]*')
        serviceApp(any: string) {
            if (!indexHtml) indexHtml = loadHtml(localPath, path);
            return indexHtml ? new HtmlResponse(indexHtml) : new HtmlResponse('Index not found', 404);
        }
    }

    module.addController(StaticController);
    module.addListener(serveStaticListener(path, localPath));
}
