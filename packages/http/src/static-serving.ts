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
import { RouteConfig, Router } from './router';

export function serveStaticListener(path: string, localPath: string = path): ClassType {
    @injectable()
    class HttpRequestStaticServingListener {
        serve(path: string, request: HttpRequest, response: HttpResponse) {
            return new Promise(resolve => {
                const res = send(request, path, { root: localPath });
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
                            new RouteConfig('static', ['GET'], event.url, {
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
 * Serves an index file and allows to load asset files from the same folder. Can be used to serve an angular application
 *
 * All paths like <path>/*.* that don't match a file are redirected to ${localPath}/index.html.
 * All paths like <path>/*.* that match a file resolve to the file.
 */
export function registerStaticHttpController(module: AppModule<any, any>, path: string, localPath: string, groups: string[] = []): void {
    let indexHtml = '';

    class StaticController {
        @http.GET().group(...groups)
        serveIndex(request: HttpRequest, response: HttpResponse) {
            if (!indexHtml) indexHtml = loadHtml(localPath, normalizeDirectory(path));
            return indexHtml ? new HtmlResponse(indexHtml) : new HtmlResponse('Index not found', 404);
        }
    }

    const route1 = new RouteConfig('static', ['GET'], normalizeDirectory(path), {
        controller: StaticController,
        module,
        methodName: 'serveIndex'
    });
    route1.groups = groups;
    module.setupProvider(Router).addRoute(route1);

    const route2 = new RouteConfig('static', ['GET'], normalizeDirectory(path).slice(0, -1), {
        controller: StaticController,
        module,
        methodName: 'serveIndex'
    })
    route2.groups = groups;
    module.setupProvider(Router).addRoute(route2);

    module.addProvider(StaticController);
    module.addListener(serveStaticListener(normalizeDirectory(path), localPath));
}
