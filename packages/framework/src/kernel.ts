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
import { mkdirSync } from 'fs';
import { join } from 'path';
import { ApplicationServer, ApplicationServerListener } from './application-server';
import { BrokerModule } from './broker/broker.module';
import { LiveDatabase } from './database/live-database';
import { DebugRouterController } from './cli/debug-router';
import { DebugDIController } from './cli/debug-di';
import { ServerStartController } from './cli/server-start';
import { DebugController } from './debug/debug.controller';
import { registerDebugHttpController } from './debug/http-debug.controller';
import { HttpKernel, HttpListener, HttpLogger, HttpModule, HttpResultFormatter, Router, serveStaticListener } from '@deepkit/http';
import { InjectorContext, injectorReference } from '@deepkit/injector';
import { kernelConfig } from './kernel.config';
import { ConsoleTransport, Logger } from '@deepkit/logger';
import { SessionHandler } from './session';
import { RpcServer, WebWorkerFactory } from './worker';
import { Stopwatch } from '@deepkit/stopwatch';
import { OrmBrowserController } from './orm-browser/controller';
import { DatabaseListener } from './database/database-listener';
import { DatabaseRegistry } from '@deepkit/orm';
import { MigrationCreateController, MigrationDownCommand, MigrationPendingCommand, MigrationProvider, MigrationUpCommand } from '@deepkit/sql/commands';
import { FileStopwatchStore } from './debug/stopwatch/store';
import { DebugDebugFramesCommand } from './cli/debug-debug-frames';
import { RpcKernelSecurity } from '@deepkit/rpc';
import { AppConfigController } from './cli/app-config';
import { Zone } from './zone';
import { DebugBroker, DebugBrokerListener } from './debug/broker';
import { ApiConsoleModule } from '@deepkit/api-console-module';
import { createModule } from '@deepkit/app';

export class KernelModule extends createModule({
    config: kernelConfig,
    providers: [
        ProcessLocker,
        ApplicationServer,
        Router,
        HttpKernel,
        HttpResultFormatter,
        WebWorkerFactory,
        RpcServer,
        ConsoleTransport,
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
        ServerStartController,
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
        new BrokerModule().forRoot(),
        new HttpModule().forRoot(),
    ],
}, 'kernel') {
    //we export anything per default
    root = true;

    process() {
        this.forRoot();

        this.setupProvider(MigrationProvider).setMigrationDir(this.config.migrationDir);
        this.setupProvider(DatabaseRegistry).setMigrateOnStartup(this.config.migrateOnStartup);

        if (this.config.httpLog) {
            this.addListener(HttpLogger);
        }

        if (this.config.publicDir) {
            this.addListener(serveStaticListener('/', this.config.publicDir));
        }

        this.setupProvider(Logger).addTransport(injectorReference(ConsoleTransport));

        if (this.config.debug) {
            mkdirSync(join(this.config.varPath, this.config.debugStorePath), { recursive: true });

            Zone.enable();

            this.addProvider({
                provide: OrmBrowserController,
                deps: [DatabaseRegistry],
                useFactory: (registry: DatabaseRegistry) => new OrmBrowserController(registry.getDatabases())
            });
            this.addController(DebugController);
            this.addController(OrmBrowserController);
            registerDebugHttpController(this, this.config.debugUrl);

            //only register the RPC controller
            this.addImport(new ApiConsoleModule({ listen: false, markdown: '' }));

            //we start our own broker
            if (this.config.debugProfiler) {
                this.addListener(DebugBrokerListener);
                this.addProvider(DebugBroker);

                this.addProvider(FileStopwatchStore);
                this.addProvider({
                    provide: Stopwatch,
                    deps: [FileStopwatchStore],
                    useFactory(store: FileStopwatchStore) {
                        return new Stopwatch(store);
                    }
                });
            }

            this.setupProvider(LiveDatabase).enableChangeFeed(DebugRequest);
        }
    }
}
