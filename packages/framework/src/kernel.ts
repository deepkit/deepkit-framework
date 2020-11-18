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
import {HttpKernel, HttpRouteListener, onHttpRequest, onHttpRouteNotFound, serveStaticListener} from './http';
import {ServerListenController} from './cli/server-listen';
import {eventDispatcher} from './decorator';
import {ApplicationServer, ApplicationServerListener} from './application-server';
import {ConsoleTransport, Logger} from './logger';
import {LiveDatabase} from './exchange/live-database';
import {inject, injectable} from './injector/injector';
import {EventDispatcher} from './service-container';
import {DebugController} from './controller/debug.controller';
import {createModule} from './module';
import {ExchangeModule} from './exchange/exchange.module';
import {kernelConfig} from './kernel.config';
import {EnvConfiguration} from './configuration';
import {WebWorkerFactory} from './worker';

class HttpLogger {
    constructor(@inject() private logger: Logger) {
    }

    @eventDispatcher.listen(onHttpRequest, -100)
    onHttpRequest(event: typeof onHttpRequest.event) {
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
    @eventDispatcher.listen(onHttpRouteNotFound, -10)
    on(event: typeof onHttpRequest.event) {
        if (event.response.finished) return;

        event.response.writeHead(404);
        event.response.end('Not found');
    }
}

@injectable()
export class BaseModuleBootstrap {
    constructor(@inject(kernelConfig.token('publicDir')) publicDir: string, eventListenerContainer: EventDispatcher) {
        if (publicDir) eventListenerContainer.registerListener(serveStaticListener(publicDir));
    }
}

export const KernelModule = createModule({
    name: 'kernel',
    bootstrap: BaseModuleBootstrap,
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
        {provide: SessionStack, scope: 'session'},
        {provide: ClientConnection, scope: 'session'},
        {provide: ConnectionMiddleware, scope: 'session'},
        {provide: LiveDatabase, scope: 'session'},
    ],
    listeners: [
        HttpRouteListener,
        HttpLogger,
        HttpRouteNotFoundListener,
        ApplicationServerListener,
    ],
    controllers: [
        DebugController,
        ServerListenController,
    ],
    imports: [
        ExchangeModule,
    ],
}).forRoot();
