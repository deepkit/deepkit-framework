/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import {http} from '../decorator';
import {join} from 'path';
import {readFileSync} from 'fs';
import {HtmlResponse, httpWorkflow} from '../http';
import {Module} from '../module';
import {injectable} from '../injector/injector';
import {eventDispatcher} from '../event';
import * as serveStatic from 'serve-static';
import {normalizeDirectory} from '../utils';

export function registerDebugHttpController(module: Module<any>, path: string): void {
    path = normalizeDirectory(path);
    const localPathPrefix = __dirname.includes('framework/dist/') ? '../../../' : '../../';
    const localPath = join(__dirname, localPathPrefix, 'node_modules/@deepkit/framework-debug-gui/dist/framework-debug-gui');
    let indexHtml = readFileSync(join(localPath, 'index.html')).toString('utf8');
    indexHtml = indexHtml.replace('<base href="/">', `<base href="${path}">`);

    @http.controller(path)
    class HttpDebugController {
        @http.GET(':path').regexp('path', '[^\.]*')
        serviceApp() {
            return new HtmlResponse(indexHtml);
        }
    }

    @injectable()
    class HttpDebugStaticServingListener {
        protected serveStatic = serveStatic(localPath, {index: false});

        @eventDispatcher.listen(httpWorkflow.onRouteNotFound, -1)
        onRouteNotFound(event: typeof httpWorkflow.onRouteNotFound.event) {
            if (event.response.finished) return;

            if (!event.request.url?.startsWith(path)) return;
            event.request.url = event.request.url.substr(path.length);

            return new Promise(resolve => {
                this.serveStatic(event.request, event.response, () => {
                    resolve(undefined);
                });
            });
        }
    }

    module.addController(HttpDebugController);
    module.addListener(HttpDebugStaticServingListener);
}
