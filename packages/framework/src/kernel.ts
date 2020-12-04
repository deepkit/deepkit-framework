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

import {ProcessLocker} from '@deepkit/core';
import {InternalClient} from './internal-client';
import {SessionStack} from './session';
import {ClientConnection} from './client-connection';
import {ConnectionMiddleware} from '@deepkit/framework-shared';
import {SecurityStrategy} from './security';
import {Router} from './router';
import {HttpKernel, HttpListener, httpWorkflow, serveStaticListener} from './http';
import {ServerListenController} from './cli/server-listen';
import {EventDispatcher, eventDispatcher} from './event';
import {ApplicationServer, ApplicationServerListener} from './application-server';
import {ConsoleTransport, Logger} from './logger';
import {LiveDatabase} from './exchange/live-database';
import {inject, injectable} from './injector/injector';
import {DebugController} from './controller/debug.controller';
import {createModule} from './module';
import {ExchangeModule} from './exchange/exchange.module';
import {kernelConfig} from './kernel.config';
import {EnvConfiguration} from './configuration';
import {WebWorkerFactory} from './worker';

class HttpLogger {
    constructor(@inject() private logger: Logger) {
    }

    @eventDispatcher.listen(httpWorkflow.onResponse)
    onHttpRequest(event: typeof httpWorkflow.onResponse.event) {
        this.logger.log(
            event.request.connection.remoteAddress, '-',
            event.request.method,
            `"${event.request.url}"`,
            event.response.statusCode,
            `"${event.request.headers.referer || ''}"`,
            `"${event.request.headers['user-agent']}"`,
        );
    }
}

class HttpRouteNotFoundListener {
    @eventDispatcher.listen(httpWorkflow.onRouteNotFound)
    on(event: typeof httpWorkflow.onRouteNotFound.event) {
        if (event.response.finished) return;

        event.response.writeHead(404);
        event.response.end('Not found');
    }
}

export const KernelModule = createModule({
    name: 'kernel',
    config: kernelConfig,
    providers: [
        ProcessLocker,
        InternalClient,
        SecurityStrategy,
        ApplicationServer,
        Router,
        HttpKernel,
        EnvConfiguration,
        WebWorkerFactory,
        {provide: Logger, useFactory: () => new Logger([new ConsoleTransport()], [])},
        {provide: SessionStack, scope: 'rpc'},
        {provide: ClientConnection, scope: 'rpc'},
        {provide: ConnectionMiddleware, scope: 'rpc'},
        {provide: LiveDatabase, scope: 'rpc'},
    ],
    listeners: [
        HttpListener,
        HttpRouteNotFoundListener,
        ApplicationServerListener,
    ],
    controllers: [
        ServerListenController,
    ],
    imports: [
        ExchangeModule,
    ],
}).setup((module, config) => {
    if (config.httpLog) {
        module.addListener(HttpLogger);
    }

    if (config.publicDir) {
        module.addListener(serveStaticListener(config.publicDir));
    }

    if (config.debug) {
        module.addController(DebugController);
    }
}).forRoot();
