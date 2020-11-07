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

import {asyncOperation, ProcessLocker} from '@deepkit/core';
import {InternalClient} from './internal-client';
import {SessionStack} from './session';
import {ClientConnection} from './client-connection';
import {ConnectionMiddleware} from '@deepkit/framework-shared';
import {SecurityStrategy} from './security';
import {Router} from './router';
import {HttpKernel, HttpListener, onHttpRequest, onHttpRouteNotFound} from './http';
import {ServerListenController} from './cli/server-listen';
import {deepkit, DynamicModule, eventDispatcher, EventOfEventToken} from './decorator';
import {ExchangeModule} from './exchange/exchange.module';
import {ApplicationServer} from './application-server';
import {ConsoleTransport, Logger} from './logger';
import {MigrationProvider} from './migration-provider';
import {MigrationCreateController} from './cli/orm/migration-create-command';
import {MigrationUpCommand} from './cli/orm/migration-up-command';
import {MigrationPendingCommand} from './cli/orm/migration-pending-command';
import {MigrationDownCommand} from './cli/orm/migration-down-command';
import {Databases} from './databases';
import {LiveDatabase} from './exchange/live-database';
import {inject, injectable} from './injector/injector';
import * as serveStatic from 'serve-static';
import {ApplicationConfig} from './application-config';

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
class HttpRequestStaticServingListener {
    protected serveStatic = serveStatic(this.config.publicDir);

    constructor(private config: ApplicationConfig) {
    }

    @eventDispatcher.listen(onHttpRequest, -1)
    onHttpRequest(event: EventOfEventToken<typeof onHttpRequest>) {
        return asyncOperation(resolve => {
            this.serveStatic(event.request, event.response, () => {
                resolve(undefined);
            });
        });
    }
}

@deepkit.module({
    providers: [
        ProcessLocker,
        InternalClient,
        SecurityStrategy,
        ApplicationServer,
        Router,
        HttpKernel,
        MigrationProvider,
        Databases,
        {provide: 'orm.databases', useValue: []},
        {provide: Logger, useFactory: () => new Logger([new ConsoleTransport()], [])},
        {provide: SessionStack, scope: 'session'},
        {provide: ClientConnection, scope: 'session'},
        {provide: ConnectionMiddleware, scope: 'session'},
        {provide: LiveDatabase, scope: 'session'},
    ],
    listeners: [
        HttpListener,
        HttpLogger,
        HttpRouteNotFoundListener,
        HttpRequestStaticServingListener,
    ],
    controllers: [
        ServerListenController,
        MigrationCreateController,
        MigrationUpCommand,
        MigrationPendingCommand,
        MigrationDownCommand
    ],
    imports: [
        ExchangeModule,
    ],
})
export class BaseModule {
    static forRoot(): DynamicModule {
        const imports: any[] = [];

        return {
            root: true,
            module: BaseModule,
            imports: imports,
        };
    }
}
