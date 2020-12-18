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
import {InternalClient} from './rpc/internal-client';
import {SessionStack} from './session';
import {ClientConnection} from './rpc/client-connection';
import {ConnectionMiddleware} from '@deepkit/framework-shared';
import {RpcSecurityStrategy} from './rpc/security';
import {Router} from './router';
import {HttpKernel, HttpListener, httpWorkflow, serveStaticListener} from './http';
import {ServerListenController} from './cli/server-listen';
import {eventDispatcher} from './event';
import {ApplicationServer, ApplicationServerListener} from './application-server';
import {ConsoleTransport, Logger} from './logger';
import {LiveDatabase} from './exchange/live-database';
import {injectable, injectorReference} from './injector/injector';
import {DebugController} from './debug/debug.controller';
import {createModule} from './module';
import {ExchangeModule} from './exchange/exchange.module';
import {kernelConfig} from './kernel.config';
import {EnvConfiguration} from './configuration';
import {WebWorkerFactory} from './worker';
import {rpcWorkflow} from './rpc/rpc';
import {registerDebugHttpController} from './debug/http-debug.controller';
import {Zone} from './zone';
import {HttpRequestDebugCollector, Debugger} from './debug/debugger';
import {DatabaseModule} from './database/database.module';
import {DebugDatabase} from './debug/db';
import {DatabaseRegistry} from './database/database-registry';
import fs from 'fs-extra';
import {dirname} from 'path';
import {DebugRouterController} from './cli/router-debug';
import {DebugRequest} from '@deepkit/framework-debug-shared';
import { DebugDIController } from './cli/router-di';

@injectable()
class HttpLogger {
    constructor(private logger: Logger) {
    }

    @eventDispatcher.listen(httpWorkflow.onResponse)
    onHttpRequest(event: typeof httpWorkflow.onResponse.event) {
        this.logger.log(
            event.request.connection.remoteAddress, '-',
            event.request.method,
            `"${event.request.url}"`,
            event.response.statusCode,
            `"${event.request.headers.referer || ''}"`,
            // `"${event.request.headers['user-agent']}"`,
        );
    }
}

export const KernelModule = createModule({
    name: 'kernel',
    config: kernelConfig,
    providers: [
        ProcessLocker,
        InternalClient,
        RpcSecurityStrategy,
        ApplicationServer,
        Router,
        HttpKernel,
        EnvConfiguration,
        WebWorkerFactory,
        ConsoleTransport,
        Logger,
        {provide: SessionStack, scope: 'rpc'},
        {provide: ClientConnection, scope: 'rpc'},
        {provide: ConnectionMiddleware, scope: 'rpc'},
        {provide: LiveDatabase, scope: 'rpc'},
        {provide: HttpListener},
        {provide: HttpRequestDebugCollector, scope: 'http'},
    ],
    workflows: [
        httpWorkflow,
        rpcWorkflow,
    ],
    listeners: [
        HttpListener,
        ApplicationServerListener,
    ],
    controllers: [
        ServerListenController,
        DebugRouterController,
        DebugDIController,
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

    module.setupProvider(Logger).addTransport(injectorReference(ConsoleTransport));

    if (config.debug) {
        fs.ensureDirSync(config.debugStorePath);
        fs.ensureDirSync(dirname(config.debugSqlitePath));

        Zone.enable();
        module.addProvider(Debugger);
        module.addController(DebugController);
        registerDebugHttpController(module, config.debugUrl);

        //this works currently only for one worker. We should move that call to onServerMainBootstrap
        module.setupProvider(LiveDatabase).enableChangeFeed(DebugRequest);

        module.addProvider(DebugDatabase);
        module.setupProvider(DatabaseRegistry).addDatabase(DebugDatabase, {migrateOnStartup: true});
    }
}).forRoot();
