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
import { DebugDatabase } from './debug/db';
import { DebugController } from './debug/debug.controller';
import { Debugger, HttpRequestDebugCollector } from './debug/debugger';
import { registerDebugHttpController } from './debug/http-debug.controller';
import { HttpKernel, HttpListener, HttpLogger, HttpModule, Router, serveStaticListener } from '@deepkit/http';
import { InjectorContext, injectorReference } from '@deepkit/injector';
import { kernelConfig } from './kernel.config';
import { ConsoleTransport, Logger } from '@deepkit/logger';
import { createModule } from '@deepkit/command';
import { DeepkitRpcSecurity } from './rpc';
import { SessionHandler } from './session';
import { WebWorkerFactory } from './worker';
import { Zone } from './zone';
import { OrmBrowserController } from './orm-browser/controller';
import { DatabaseListener } from './database/database-listener';
import { DatabaseRegistry } from '@deepkit/orm';
import { MigrationCreateController, MigrationDownCommand, MigrationPendingCommand, MigrationProvider, MigrationUpCommand } from '@deepkit/sql';

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
        MigrationProvider,
        { provide: DatabaseRegistry, deps: [InjectorContext], useFactory: (ic) => new DatabaseRegistry(ic) },
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

        MigrationUpCommand,
        MigrationDownCommand,
        MigrationPendingCommand,
        MigrationCreateController,
    ],
    imports: [
        BrokerModule,
        HttpModule,
    ],
}).setup((module, config) => {
    if (config.databases) {
        module.addProvider(...config.databases);
        module.setupProvider(MigrationProvider).setMigrationDir(config.migrationDir);
        for (const db of config.databases) module.setupProvider(DatabaseRegistry).addDatabase(db);
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
