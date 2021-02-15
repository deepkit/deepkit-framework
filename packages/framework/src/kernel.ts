/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ProcessLocker } from '@deepkit/core';
import { DebugRequest } from '@deepkit/framework-debug-api';
import fs from 'fs-extra';
import { dirname } from 'path';
import { ApplicationServer, ApplicationServerListener } from './application-server';
import { BrokerModule } from './broker/broker.module';
import { LiveDatabase } from './database/live-database';
import { DebugRouterController } from './cli/router-debug';
import { DebugDIController } from './cli/router-di';
import { ServerListenController } from './cli/server-listen';
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
import { HttpKernel, HttpListener, HttpLogger, HttpModule, Router, serveStaticListener } from '@deepkit/http';
import { injectorReference } from '@deepkit/injector';
import { kernelConfig } from './kernel.config';
import { ConsoleTransport, Logger } from '@deepkit/logger';
import { createModule } from '@deepkit/command';
import { DeepkitRpcSecurity } from './rpc';
import { SessionHandler } from './session';
import { WebWorkerFactory } from './worker';
import { Zone } from './zone';
import { OrmBrowserController } from './orm-browser/controller';

export const KernelModule = createModule({
    name: 'kernel',
    config: kernelConfig,
    providers: [
        ProcessLocker,
        ApplicationServer,
        Router,
        HttpKernel,
        WebWorkerFactory,
        ConsoleTransport,
        Logger,
        DeepkitRpcSecurity,
        DatabaseRegistry,
        MigrationProvider,
        { provide: LiveDatabase, scope: 'rpc' },
        { provide: HttpListener },
        { provide: SessionHandler, scope: 'http' },
        { provide: HttpRequestDebugCollector, scope: 'http' },
    ],
    workflows: [
        // httpWorkflow
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
        HttpModule,
    ],
}).setup((module, config) => {
    if (config.databases) {
        module.addProvider(...config.databases);
    }

    if (config.httpLog) {
        module.addListener(HttpLogger);
    }

    if (config.publicDir) {
        module.addListener(serveStaticListener('/', config.publicDir));
    }

    module.setupProvider(Logger).addTransport(injectorReference(ConsoleTransport));

    if (config.debug) {
        fs.ensureDirSync(config.debugStorePath);
        fs.ensureDirSync(dirname(config.debugSqlitePath));

        Zone.enable();
        module.addProvider(Debugger);
        module.addProvider({ provide: OrmBrowserController, deps: [DatabaseRegistry], useFactory: (registry: DatabaseRegistry) => new OrmBrowserController(registry.getDatabases()) });
        module.addController(DebugController);
        module.addController(OrmBrowserController);
        registerDebugHttpController(module, config.debugUrl);

        module.setupProvider(LiveDatabase).enableChangeFeed(DebugRequest);

        module.addProvider(DebugDatabase);
        module.setupProvider(DatabaseRegistry).addDatabase(DebugDatabase, { migrateOnStartup: true });
    }
}).forRoot();
