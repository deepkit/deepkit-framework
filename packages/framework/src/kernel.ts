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
import {eventDispatcher, EventOfEventToken} from './decorator';
import {ApplicationServer} from './application-server';
import {ConsoleTransport, Logger} from './logger';
import {LiveDatabase} from './exchange/live-database';
import {inject, injectable} from './injector/injector';
import {ApplicationConfig} from './application-config';
import {EventDispatcher} from './service-container';
import {DebugController} from './controller/debug.controller';
import {createModule} from './module';
import {ExchangeModule} from './exchange/exchange.module';

class HttpLogger {
    constructor(@inject() private logger: Logger) {
    }

    @eventDispatcher.listen(onHttpRequest, -100)
    onHttpRequest(event: EventOfEventToken<typeof onHttpRequest>) {
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
    on(event: EventOfEventToken<typeof onHttpRouteNotFound>) {
        if (event.response.finished) return;

        event.response.writeHead(404);
        event.response.end('Not found');
    }
}

@injectable()
export class BaseModuleBootstrap {
    constructor(config: ApplicationConfig, eventListenerContainer: EventDispatcher) {
        if (config.publicDir) eventListenerContainer.registerListener(serveStaticListener(config.publicDir));
    }
}

export const KernelModule = createModule({
    name: 'kernel',
    bootstrap: BaseModuleBootstrap,
    providers: [
        ProcessLocker,
        InternalClient,
        SecurityStrategy,
        ApplicationServer,
        Router,
        HttpKernel,
        {provide: 'orm.databases', useValue: []},
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
    ],
    controllers: [
        DebugController,
        ServerListenController,
    ],
    imports: [
        ExchangeModule,
    ],
});
