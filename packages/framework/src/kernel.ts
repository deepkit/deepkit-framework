/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType, ProcessLocker } from '@deepkit/core';
import { DebugRequest } from '@deepkit/framework-debug-api';
import fs from 'fs-extra';
import { join } from 'path';
import { ApplicationServer, ApplicationServerListener } from './application-server';
import { BrokerModule } from './broker/broker.module';
import { LiveDatabase } from './database/live-database';
import { DebugRouterController } from './cli/debug-router';
import { DebugDIController } from './cli/debug-di';
import { ServerListenController } from './cli/server-listen';
import { DebugController } from './debug/debug.controller';
import { registerDebugHttpController } from './debug/http-debug.controller';
import { HttpKernel, HttpListener, HttpLogger, HttpModule, Router, serveStaticListener } from '@deepkit/http';
import { InjectorContext, injectorReference } from '@deepkit/injector';
import { kernelConfig } from './kernel.config';
import { ConsoleTransport, Logger } from '@deepkit/logger';
import { SessionHandler } from './session';
import { WebWorkerFactory } from './worker';
import { Stopwatch } from '@deepkit/stopwatch';
import { OrmBrowserController } from './orm-browser/controller';
import { DatabaseListener } from './database/database-listener';
import { Database, DatabaseRegistry } from '@deepkit/orm';
import { MigrationCreateController, MigrationDownCommand, MigrationPendingCommand, MigrationProvider, MigrationUpCommand } from '@deepkit/sql/commands';
import { AppModule } from '@deepkit/app';
import { FileStopwatchStore } from './debug/stopwatch/store';
import { DebugDebugFramesCommand } from './cli/debug-debug-frames';
import { RpcKernelSecurity } from '@deepkit/rpc';
import { AppConfigController } from './cli/app-config';

export const KernelModule = new AppModule({
    config: kernelConfig,
    providers: [
        ProcessLocker,
        ApplicationServer,
        Router,
        HttpKernel,
        WebWorkerFactory,
        ConsoleTransport,
        Stopwatch,
        Logger,
        RpcKernelSecurity,
        MigrationProvider,
        DebugController,
        { provide: DatabaseRegistry, deps: [InjectorContext], useFactory: (ic) => new DatabaseRegistry(ic) },
        { provide: LiveDatabase, scope: 'rpc' },
        { provide: HttpListener },
        { provide: SessionHandler, scope: 'http' },
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
        DebugDebugFramesCommand,
        AppConfigController,

        MigrationUpCommand,
        MigrationDownCommand,
        MigrationPendingCommand,
        MigrationCreateController,
    ],
    imports: [
        BrokerModule,
        HttpModule,
    ],
}, 'kernel').setup((module, config) => {
    if (config.databases) {
        const dbs: ClassType<Database>[] = config.databases;
        module.addProvider(...dbs);
        module.setupProvider(MigrationProvider).setMigrationDir(config.migrationDir);
        for (const db of dbs) {
            module.setupProvider(DatabaseRegistry).addDatabase(db);
            module.setupProvider(db).stopwatch = injectorReference(Stopwatch);
        }
    }
    module.setupProvider(DatabaseRegistry).setMigrateOnStartup(config.migrateOnStartup);

    if (config.httpLog) {
        module.addListener(HttpLogger);
    }

    if (config.publicDir) {
        module.addListener(serveStaticListener('/', config.publicDir));
    }

    module.setupProvider(Logger).addTransport(injectorReference(ConsoleTransport));

    if (config.debug) {
        fs.ensureDirSync(join(config.varPath, config.debugStorePath));

        //this segfaults on node v16, so disable for the moment, until the framework debugger is fully launched
        // Zone.enable();

        module.addProvider({ provide: OrmBrowserController, deps: [DatabaseRegistry], useFactory: (registry: DatabaseRegistry) => new OrmBrowserController(registry.getDatabases()) });
        module.addController(DebugController);
        module.addController(OrmBrowserController);
        registerDebugHttpController(module, config.debugUrl);

        module.addProvider(FileStopwatchStore);
        module.addProvider({
            provide: Stopwatch,
            deps: [FileStopwatchStore],
            useFactory(store: FileStopwatchStore) {
                return new Stopwatch(store);
            }
        });
        module.setupProvider(LiveDatabase).enableChangeFeed(DebugRequest);
    }
}).forRoot();
