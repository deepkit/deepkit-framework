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
import { EventDispatcher } from '@deepkit/event';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { ApplicationServer, ApplicationServerListener } from './application-server.js';
import { BrokerModule } from './broker/broker.module.js';
import { DebugRouterController } from './cli/debug-router.js';
import { DebugDIController } from './cli/debug-di.js';
import { ServerStartController } from './cli/server-start.js';
import { DebugController } from './debug/debug.controller.js';
import { registerDebugHttpController } from './debug/http-debug.controller.js';
import { HttpLogger, HttpModule, HttpRequest, serveStaticListener } from '@deepkit/http';
import { InjectorContext, injectorReference, ProviderWithScope, Token } from '@deepkit/injector';
import { FrameworkConfig } from './module.config.js';
import { ConsoleTransport, Logger, LoggerInterface } from '@deepkit/logger';
import { SessionHandler } from './session.js';
import { RpcServer, WebWorkerFactory } from './worker.js';
import { Stopwatch } from '@deepkit/stopwatch';
import { OrmBrowserController } from './orm-browser/controller.js';
import { DatabaseListener } from './database/database-listener.js';
import { Database, DatabaseRegistry } from '@deepkit/orm';
import { MigrationCreateController, MigrationDownCommand, MigrationPendingCommand, MigrationProvider, MigrationUpCommand } from '@deepkit/sql/commands';
import { FileStopwatchStore } from './debug/stopwatch/store.js';
import { DebugDebugFramesCommand } from './cli/debug-debug-frames.js';
import { ConnectionWriter, rpcClass, RpcKernel, RpcKernelBaseConnection, RpcKernelConnection, RpcKernelSecurity, SessionState } from '@deepkit/rpc';
import { AppConfigController } from './cli/app-config.js';
import { Zone } from './zone.js';
import { DebugBroker, DebugBrokerListener } from './debug/broker.js';
import { ApiConsoleModule } from '@deepkit/api-console-module';
import { AppModule, createModule } from '@deepkit/app';
import { RpcControllers, RpcInjectorContext, RpcKernelWithStopwatch } from './rpc.js';
import { normalizeDirectory } from './utils.js';

export class FrameworkModule extends createModule({
    config: FrameworkConfig,
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
        { provide: DatabaseRegistry, useFactory: (ic: InjectorContext) => new DatabaseRegistry(ic) },
        {
            provide: RpcKernel,
            useFactory(rpcControllers: RpcControllers, injectorContext: InjectorContext, rpcKernelSecurity: RpcKernelSecurity, logger: LoggerInterface, stopwatch?: Stopwatch) {
                const classType = stopwatch ? RpcKernelWithStopwatch : RpcKernel;
                const kernel: RpcKernel = new classType(injectorContext, rpcKernelSecurity, logger.scoped('rpc'));

                if (kernel instanceof RpcKernelWithStopwatch) {
                    kernel.stopwatch = stopwatch;
                }

                for (const [name, info] of rpcControllers.controllers.entries()) {
                    kernel.registerController(info.controller, name, info.module);
                }

                return kernel;
            }
        },

        //move to HttpModule?
        { provide: SessionHandler, scope: 'http' },

        // { provide: LiveDatabase, scope: 'rpc' },

        //all of these will be set on scope creation
        { provide: HttpRequest, scope: 'rpc', useValue: undefined },
        { provide: RpcInjectorContext, scope: 'rpc', useValue: undefined },
        { provide: SessionState, scope: 'rpc', useValue: undefined },
        { provide: RpcKernelBaseConnection, scope: 'rpc', useValue: undefined },
        { provide: RpcKernelConnection, scope: 'rpc', useValue: undefined },
        { provide: ConnectionWriter, scope: 'rpc', useValue: undefined },
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
    exports: [
        ProcessLocker,
        ApplicationServer,
        WebWorkerFactory,
        RpcServer,
        ConsoleTransport,
        Logger,
        RpcKernelSecurity,
        RpcKernel,
        MigrationProvider,

        DatabaseRegistry,
        SessionHandler,

        HttpRequest,
        RpcInjectorContext,
        SessionState,
        RpcKernelConnection,
        RpcKernelBaseConnection,
        ConnectionWriter,

        BrokerModule,
        HttpModule,
    ]
}, 'framework') {
    imports = [
        new BrokerModule(),
        new HttpModule(),
    ];

    protected dbs: { module: AppModule<any>, classType: ClassType }[] = [];
    protected rpcControllers = new RpcControllers;

    process() {
        this.addImport();
        this.addProvider({ provide: RpcControllers, useValue: this.rpcControllers });

        this.setupProvider<MigrationProvider>().setMigrationDir(this.config.migrationDir);
        this.setupProvider<DatabaseRegistry>().setMigrateOnStartup(this.config.migrateOnStartup);

        if (this.config.httpLog) {
            this.addListener(HttpLogger);
        }

        if (this.config.publicDir) {
            this.addListener(serveStaticListener(this, normalizeDirectory(this.config.publicDirPrefix), this.config.publicDir));
        }

        this.setupProvider<Logger>().addTransport(injectorReference(ConsoleTransport));

        if (this.config.debug) {
            mkdirSync(join(this.config.varPath, this.config.debugStorePath), { recursive: true });

            Zone.enable();

            this.addProvider({
                provide: OrmBrowserController,
                useFactory: (registry: DatabaseRegistry) => new OrmBrowserController(registry.getDatabases())
            });
            this.addController(DebugController);
            this.addController(OrmBrowserController);
            registerDebugHttpController(this, this.config.debugUrl);

            //only register the RPC controller
            this.addImport(new ApiConsoleModule({ listen: false, markdown: '' }).rename('internalApi'));

            //we start our own broker
            if (this.config.debugProfiler) {
                this.addListener(DebugBrokerListener);
                this.addProvider(DebugBroker);

                this.addProvider(FileStopwatchStore);
                this.addProvider({
                    provide: Stopwatch,
                    useFactory(store: FileStopwatchStore) {
                        return new Stopwatch(store);
                    }
                });
                this.addExport(Stopwatch);
            }

            // this.setupProvider(LiveDatabase).enableChangeFeed(DebugRequest);
        }
    }

    postProcess() {
        //all providers are known at this point
        this.setupDatabase();
    }

    protected setupDatabase() {
        for (const db of this.dbs) {
            this.setupProvider<DatabaseRegistry>().addDatabase(db.classType, {}, db.module);
            db.module.setupProvider(0, db.classType).eventDispatcher = injectorReference(EventDispatcher);
        }

        if (this.config.debug && this.config.debugProfiler) {
            for (const db of this.dbs) {
                db.module.setupProvider(0, db.classType).stopwatch = injectorReference(Stopwatch);
            }
        }
    }

    processProvider(module: AppModule<any>, token: Token, provider: ProviderWithScope) {
        if (!isClass(token)) return;
        if (isPrototypeOfBase(token, Database)) {
            this.dbs.push({ classType: token as ClassType, module });
        }
    }

    processController(module: AppModule<any>, controller: ClassType) {
        const rpcConfig = rpcClass._fetch(controller);
        if (!rpcConfig) return;

        if (!module.isProvided(controller)) module.addProvider({ provide: controller, scope: 'rpc' });
        if (this.rpcControllers.controllers.has(rpcConfig.getPath())) {
            throw new Error(`Already an RPC controller with the name ${rpcConfig.getPath()} registered.`);
        }
        this.rpcControllers.controllers.set(rpcConfig.getPath(), { controller, module });
    }
}
