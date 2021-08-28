/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType, isClass, isPrototypeOfBase, ProcessLocker } from '@deepkit/core';
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
import { HttpLogger, HttpModule, HttpRequest, serveStaticListener } from '@deepkit/http';
import { InjectorContext, injectorReference, ProviderWithScope, TagProvider } from '@deepkit/injector';
import { frameworkConfig } from './module.config';
import { ConsoleTransport, Logger } from '@deepkit/logger';
import { SessionHandler } from './session';
import { RpcServer, WebWorkerFactory } from './worker';
import { Stopwatch } from '@deepkit/stopwatch';
import { OrmBrowserController } from './orm-browser/controller';
import { DatabaseListener } from './database/database-listener';
import { Database, DatabaseRegistry } from '@deepkit/orm';
import { MigrationCreateController, MigrationDownCommand, MigrationPendingCommand, MigrationProvider, MigrationUpCommand } from '@deepkit/sql/commands';
import { FileStopwatchStore } from './debug/stopwatch/store';
import { DebugDebugFramesCommand } from './cli/debug-debug-frames';
import { ConnectionWriter, rpcClass, RpcKernelBaseConnection, RpcKernelConnection, RpcKernelSecurity, SessionState } from '@deepkit/rpc';
import { AppConfigController } from './cli/app-config';
import { Zone } from './zone';
import { DebugBroker, DebugBrokerListener } from './debug/broker';
import { ApiConsoleModule } from '@deepkit/api-console-module';
import { AppModule, createModule } from '@deepkit/app';
import { RpcControllers, RpcInjectorContext } from './rpc';

export class FrameworkModule extends createModule({
    config: frameworkConfig,
    providers: [
        ProcessLocker,
        ApplicationServer,
        WebWorkerFactory,
        RpcServer,
        ConsoleTransport,
        Logger,
        RpcKernelSecurity,
        MigrationProvider,
        DebugController,
        { provide: DatabaseRegistry, deps: [InjectorContext], useFactory: (ic) => new DatabaseRegistry(ic) },

        //move to HttpModule?
        { provide: SessionHandler, scope: 'http' },

        { provide: LiveDatabase, scope: 'rpc' },
        { provide: HttpRequest, scope: 'rpc' },
        { provide: RpcInjectorContext, scope: 'rpc' },
        { provide: SessionState, scope: 'rpc' },
        { provide: RpcKernelBaseConnection, scope: 'rpc' },
        { provide: RpcKernelConnection, scope: 'rpc' },
        { provide: ConnectionWriter, scope: 'rpc' },
    ],
    workflows: [
        // rpcWorkflow,
    ],
    listeners: [
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
}, 'framework') {
    imports = [
        new BrokerModule().forRoot(),
        new HttpModule(),
    ];

    //we export anything per default
    root = true;
    protected dbs: { module: AppModule<any>, classType: ClassType }[] = [];
    protected rpcControllers = new RpcControllers;

    process() {
        this.addImport();
        this.forRoot();
        this.addProvider({ provide: RpcControllers, useValue: this.rpcControllers });

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

    postProcess() {
        //all providers are known at this point
        this.setupDatabase();
    }

    protected setupDatabase() {
        for (const db of this.dbs) {
            this.setupProvider(DatabaseRegistry).addDatabase(db.classType, {}, db.module);
        }

        if (this.config.debug && this.config.debugProfiler) {
            for (const db of this.dbs) {
                this.setupProvider(db.classType).stopwatch = injectorReference(Stopwatch);
            }
        }
    }

    handleProviders(module: AppModule<any>, providers: ProviderWithScope[]) {
        for (const provider of providers) {
            if (provider instanceof TagProvider) continue;
            const provide = isClass(provider) ? provider : provider.provide;
            if (!isClass(provide)) continue;
            if (isPrototypeOfBase(provide, Database)) {
                this.dbs.push({ classType: provide, module });
            }
        }
    }

    handleControllers(module: AppModule<any>, controllers: ClassType[]) {
        for (const controller of controllers) {
            const rpcConfig = rpcClass._fetch(controller);
            if (!rpcConfig) continue;

            if (!module.isProvided(controller)) module.addProvider({ provide: controller, scope: 'rpc' });
            if (this.rpcControllers.controllers.has(rpcConfig.getPath())) {
                throw new Error(`Already an RPC controller with the name ${rpcConfig.getPath()} registered.`);
            }
            this.rpcControllers.controllers.set(rpcConfig.getPath(), { controller, module });
        }
    }
}
