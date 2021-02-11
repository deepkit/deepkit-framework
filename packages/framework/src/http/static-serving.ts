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
import { HtmlResponse, serveStaticListener } from '../http';
import { Module } from '../module';
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

/**
 * Serves files from a local directory at `path`. All paths without . are redirected to
 * ${localPath}/index.html.
 */
export function registerStaticHttpController(module: Module<any>, path: string, localPath: string): void {
    path = normalizeDirectory(path);
    let indexHtml = '';

    @http.controller(path)
    class HttpDebugController {
        @http.GET(':any').regexp('any', '[^\.]*')
        serviceApp(any: string) {
            if (!indexHtml) indexHtml = loadHtml(localPath, path);
            return indexHtml ? new HtmlResponse(indexHtml) : new HtmlResponse('Index not found', 404);
        }
    }

    module.addController(HttpDebugController);
    module.addListener(serveStaticListener('/', localPath));
}
