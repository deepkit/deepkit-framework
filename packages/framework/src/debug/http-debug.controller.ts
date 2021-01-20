/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { http } from '../decorator';
import { join } from 'path';
import { readFileSync } from 'fs';
import { HtmlResponse, httpWorkflow } from '../http';
import { Module } from '../module';
import { injectable } from '../injector/injector';
import { eventDispatcher } from '../event';
import serveStatic from 'serve-static';
import { normalizeDirectory } from '../utils';

function loadHtml(localPath: string, path: string): string {
    try {
        let indexHtml = readFileSync(join(localPath, 'index.html')).toString('utf8');
        indexHtml = indexHtml.replace('<base href="/">', `<base href="${path}">`);
        return indexHtml;
    } catch (error) {
        return '';
    }
}

export function registerDebugHttpController(module: Module<any>, path: string): void {
    path = normalizeDirectory(path);
    const localPathPrefix = import.meta.url.replace('file://', '').includes('framework/dist/') ? '../../../../' : '../../../';
    const localPath = join(import.meta.url.replace('file://', ''), localPathPrefix, 'node_modules/@deepkit/framework-debug-gui/dist/framework-debug-gui');

    let indexHtml = '';

    @http.controller(path)
    class HttpDebugController {
        @http.GET(':any').regexp('any', '[^\.]*')
        serviceApp(any: string) {
            if (!indexHtml) indexHtml = loadHtml(localPath, path);
            return new HtmlResponse(indexHtml);
        }
    }

    @injectable()
    class HttpDebugStaticServingListener {
        protected serveStatic = serveStatic(localPath, { index: false });

        @eventDispatcher.listen(httpWorkflow.onRouteNotFound, -1)
        onRouteNotFound(event: typeof httpWorkflow.onRouteNotFound.event) {
            if (event.response.finished) return;

            if (!event.request.url?.startsWith(path)) return;
            event.request.url = event.request.url.substr(path.length);

            return new Promise(resolve => {
                event.response.once('finish', () => {
                    resolve(undefined);
                });
                this.serveStatic(event.request, event.response, () => {
                    resolve(undefined);
                });
            });
        }
    }

    module.addController(HttpDebugController);
    module.addListener(HttpDebugStaticServingListener);
}
