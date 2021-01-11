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

import { ProcessLocker } from '@deepkit/core';
import { DebugRequest } from '@deepkit/framework-debug-shared';
import fs from 'fs-extra';
import { dirname } from 'path';
import { ApplicationServer, ApplicationServerListener } from './application-server';
import { BrokerModule } from './broker/broker.module';
import { LiveDatabase } from './database/live-database';
import { DebugRouterController } from './cli/router-debug';
import { DebugDIController } from './cli/router-di';
import { ServerListenController } from './cli/server-listen';
import { EnvConfiguration } from './configuration';
import { DatabaseRegistry } from './database-registry';
import { MigrationCreateController } from './database/cli/migration-create-command';
import { MigrationDownCommand } from './database/cli/migration-down-command';
import { MigrationPendingCommand } from './database/cli/migration-pending-command';
import { MigrationUpCommand } from './database/cli/migration-up-command';
import { DatabaseListener } from './database/database-listener';
import { MigrationProvider } from './database/migration-provider';
import { DebugDatabase } from './debug/db';
import { DebugController } from './debug/debug.controller';
import { Debugger, HttpRequestDebugCollector } from './debug/debugger';
import { registerDebugHttpController } from './debug/http-debug.controller';
import { eventDispatcher } from './event';
import { HttpKernel, HttpListener, httpWorkflow, serveStaticListener } from './http';
import { injectable, injectorReference } from './injector/injector';
import { kernelConfig } from './kernel.config';
import { ConsoleTransport, Logger } from './logger';
import { createModule } from './module';
import { Router } from './router';
import { DeepkitRpcSecurity } from './rpc';
import { SessionStack } from './session';
import { WebWorkerFactory } from './worker';
import { Zone } from './zone';

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
        ApplicationServer,
        Router,
        HttpKernel,
        EnvConfiguration,
        WebWorkerFactory,
        ConsoleTransport,
        Logger,
        DeepkitRpcSecurity,
        DatabaseRegistry,
        MigrationProvider,
        { provide: LiveDatabase, scope: 'rpc' },
        { provide: HttpListener },
        { provide: SessionStack, scope: 'http' },
        { provide: HttpRequestDebugCollector, scope: 'http' },
    ],
    workflows: [
        httpWorkflow,
        // rpcWorkflow,
    ],
    listeners: [
        HttpListener,
        ApplicationServerListener,
        DatabaseListener,
    ],
    controllers: [
        ServerListenController,
        DebugRouterController,
        DebugDIController,

        MigrationCreateController,
        MigrationUpCommand,
        MigrationPendingCommand,
        MigrationDownCommand,
    ],
    imports: [
        BrokerModule,
    ],
}).setup((module, config) => {
    if (config.databases) {
        module.options.providers.push(...config.databases);
    }

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
        module.setupProvider(DatabaseRegistry).addDatabase(DebugDatabase, { migrateOnStartup: true });
    }
}).forRoot();
