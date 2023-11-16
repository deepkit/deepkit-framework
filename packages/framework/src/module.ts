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
import { DebugRouterController } from './cli/debug-router.js';
import { DebugDIController } from './cli/debug-di.js';
import { ServerStartController } from './cli/server-start.js';
import { DebugController } from './debug/debug.controller.js';
import { registerDebugHttpController } from './debug/http-debug.controller.js';
import { http, HttpLogger, HttpModule, HttpRequest, serveStaticListener } from '@deepkit/http';
import { InjectorContext, injectorReference, ProviderWithScope, Token } from '@deepkit/injector';
import { BrokerConfig, FrameworkConfig } from './module.config.js';
import { LoggerInterface } from '@deepkit/logger';
import { SessionHandler } from './session.js';
import { RpcServer, WebWorkerFactory } from './worker.js';
import { Stopwatch, StopwatchStore } from '@deepkit/stopwatch';
import { OrmBrowserController } from './orm-browser/controller.js';
import { DatabaseListener } from './database/database-listener.js';
import { Database, DatabaseRegistry } from '@deepkit/orm';
import { MigrationCreateController, MigrationDownCommand, MigrationPendingCommand, MigrationProvider, MigrationUpCommand } from '@deepkit/sql/commands';
import { FileStopwatchStore } from './debug/stopwatch/store.js';
import { DebugDebugFramesCommand } from './cli/debug-debug-frames.js';
import { ConnectionWriter, rpcClass, RpcKernel, RpcKernelBaseConnection, RpcKernelConnection, RpcKernelSecurity, SessionState } from '@deepkit/rpc';
import { AppConfigController } from './cli/app-config.js';
import { Zone } from './zone.js';
import { DebugBroker } from './debug/broker.js';
import { ApiConsoleModule } from '@deepkit/api-console-module';
import { AppModule, ControllerConfig, createModule, onAppShutdown } from '@deepkit/app';
import { RpcControllers, RpcInjectorContext, RpcKernelWithStopwatch } from './rpc.js';
import { normalizeDirectory } from './utils.js';
import { FilesystemRegistry, PublicFilesystem } from './filesystem.js';
import { Filesystem } from '@deepkit/filesystem';
import { MediaController } from './debug/media.controller.js';
import { DebugHttpController } from './debug/debug-http.controller.js';
import { BrokerServer } from './broker/broker.js';
import { BrokerListener } from './broker/listener.js';
import { Broker, BrokerDeepkitAdapter } from '@deepkit/broker';

export class FrameworkModule extends createModule({
    config: FrameworkConfig,
    providers: [
        ProcessLocker,
        ApplicationServer,
        WebWorkerFactory,
        RpcServer,
        MigrationProvider,
        DebugController,
        BrokerServer,
        FilesystemRegistry,
        { provide: DatabaseRegistry, useFactory: (ic: InjectorContext) => new DatabaseRegistry(ic) },
        {
            provide: RpcKernel,
            useFactory(rpcControllers: RpcControllers, injectorContext: InjectorContext, logger: LoggerInterface, stopwatch?: Stopwatch) {
                const classType = stopwatch ? RpcKernelWithStopwatch : RpcKernel;
                const kernel: RpcKernel = new classType(injectorContext, logger.scoped('rpc'));

                if (kernel instanceof RpcKernelWithStopwatch) {
                    kernel.stopwatch = stopwatch;
                }

                for (const [name, info] of rpcControllers.controllers.entries()) {
                    kernel.registerController(info.controller, name, info.module);
                }

                return kernel;
            }
        },

        {
            provide: Broker, useFactory(config: BrokerConfig) {
                return new Broker(new BrokerDeepkitAdapter({ servers: [{ url: config.host }] }));
            }
        },

        //move to HttpModule?
        { provide: SessionHandler, scope: 'http' },

        // { provide: LiveDatabase, scope: 'rpc' },
        { provide: RpcKernelSecurity, scope: 'rpc' },

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
        BrokerListener,
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

        Broker,
        BrokerServer,

        HttpModule,
    ]
}, 'framework') {
    imports = [
        new HttpModule(),
    ];

    protected dbs: { module: AppModule<any>, classType: ClassType }[] = [];
    protected filesystems: { module: AppModule<any>, classType: ClassType }[] = [];

    protected rpcControllers = new RpcControllers;

    process() {
        this.addImport();
        this.addProvider({ provide: RpcControllers, useValue: this.rpcControllers });

        this.setupProvider<MigrationProvider>().setMigrationDir(this.config.migrationDir);
        this.setupProvider<DatabaseRegistry>().setMigrateOnStartup(this.config.migrateOnStartup);

        if (this.config.httpLog) {
            this.addListener(HttpLogger);
        }

        this.getImportedModuleByClass(HttpModule).configure({ parser: this.config.httpParse });

        if (this.config.publicDir) {
            const localPublicDir = join(process.cwd(), this.config.publicDir);

            this.addListener(serveStaticListener(this, normalizeDirectory(this.config.publicDirPrefix), localPublicDir));

            this.addProvider({
                provide: PublicFilesystem, useFactory: () => {
                    return new PublicFilesystem(localPublicDir, this.config.publicDirPrefix);
                }
            });
        }

        if (this.config.debug) {
            mkdirSync(join(this.config.varPath, this.config.debugStorePath), { recursive: true });

            Zone.enable();

            this.addProvider({
                provide: OrmBrowserController,
                useFactory: (registry: DatabaseRegistry) => new OrmBrowserController(registry.getDatabases())
            });
            this.addController(DebugController);
            this.addController(MediaController);
            this.addController(OrmBrowserController);
            registerDebugHttpController(this, this.config.debugUrl);

            @http.controller(this.config.debugUrl)
            class ScopedDebugHttpController extends DebugHttpController {
            }

            this.addController(ScopedDebugHttpController);

            //only register the RPC controller
            this.addImport(new ApiConsoleModule({ listen: false, markdown: '' }).rename('internalApi'));

            this.addListener(onAppShutdown.listen(async (
                event, broker: DebugBroker, store: StopwatchStore) => {
                await store.close();
                await broker.disconnect();
            }));

            // this.setupProvider(LiveDatabase).enableChangeFeed(DebugRequest);
        }

        this.addProvider(DebugBroker);
        this.addProvider(FileStopwatchStore);
        this.addProvider({ provide: StopwatchStore, useExisting: FileStopwatchStore });
        this.addProvider({
            provide: Stopwatch,
            useFactory(store: StopwatchStore, config: FrameworkConfig) {
                const stopwatch = new Stopwatch(store);
                if (config.profile || config.debug) {
                    stopwatch.enable();
                } else {
                    stopwatch.disable();
                }
                return stopwatch;
            }
        });
        this.addExport(Stopwatch);
    }

    postProcess() {
        //all providers are known at this point
        this.setupDatabase();

        for (const fs of this.filesystems) {
            this.setupProvider<FilesystemRegistry>().addFilesystem(fs.classType, fs.module);
        }
    }

    protected setupDatabase() {
        for (const db of this.dbs) {
            this.setupProvider<DatabaseRegistry>().addDatabase(db.classType, {}, db.module);
            db.module.setupProvider(0, db.classType).eventDispatcher = injectorReference(EventDispatcher);
        }

        if (this.config.debug && this.config.profile) {
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
        if (isPrototypeOfBase(token, Filesystem)) {
            this.filesystems.push({ classType: token as ClassType, module });
        }
    }

    processController(module: AppModule<any>, config: ControllerConfig) {
        const controller = config.controller;
        if (!controller) return;

        const rpcConfig = rpcClass._fetch(controller);
        if (!rpcConfig) return;

        if (!module.isProvided(controller)) module.addProvider({ provide: controller, scope: 'rpc' });
        if (this.rpcControllers.controllers.has(rpcConfig.getPath())) {
            throw new Error(`Already an RPC controller with the name ${rpcConfig.getPath()} registered.`);
        }
        this.rpcControllers.controllers.set(rpcConfig.getPath(), { controller, module });
    }
}
