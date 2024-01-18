/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { BrokerBus, BrokerCache, BrokerDeepkitAdapter, BrokerKernel, BrokerLock, BrokerQueue } from '@deepkit/broker';
import { ClassType } from '@deepkit/core';
import { ConsoleTransport, Logger, LogMessage, MemoryLoggerTransport } from '@deepkit/logger';
import { Database, DatabaseRegistry, MemoryDatabaseAdapter } from '@deepkit/orm';
import { ApplicationServer } from './application-server.js';
import { BrokerServer } from './broker/broker.js';
import { injectorReference } from '@deepkit/injector';
import { App, AppModule, RootAppModule, RootModuleDefinition } from '@deepkit/app';
import { WebMemoryWorkerFactory, WebWorkerFactory } from './worker.js';
import { MemoryHttpResponse, RequestBuilder } from '@deepkit/http';
import { RpcClient, RpcDirectClientAdapter } from '@deepkit/rpc';
import { FrameworkModule } from './module.js';
import { DebugBrokerBus } from './debug/broker.js';

/**
 * @deprecated use {@link MemoryHttpResponse} instead
 */
export class TestHttpResponse extends MemoryHttpResponse {
}

export class TestingFacade<A extends App<any>> {
    constructor(public app: A) {
    }

    getLogger(): MemoryLoggerTransport {
        return this.app.get(MemoryLoggerTransport);
    }

    public async startServer() {
        await this.app.get(ApplicationServer).start();
    }

    public async stopServer(graceful = false) {
        await this.app.get(ApplicationServer).close(graceful);
    }

    public async request(requestBuilder: RequestBuilder): Promise<MemoryHttpResponse> {
        const request = requestBuilder.build();
        const response = new MemoryHttpResponse(request);
        await this.app.get(ApplicationServer).getHttpWorker().handleRequest(request, response);
        return response;
    }

    public createRpcClient(): RpcClient {
        return this.app.get(ApplicationServer).createClient();
    }

    public getLogMessages(): LogMessage[] {
        return this.app.get(MemoryLoggerTransport).messages;
    }
}

export class BrokerMemoryServer extends BrokerServer {
    public kernel = new BrokerKernel();

    async start() {
    }

    async stop() {
    }
}

/**
 * Creates a new App instance, but with kernel services in place that work in memory.
 * For example RPC/Broker/HTTP communication without TCP stack. Logger uses MemoryLogger.
 */
export function createTestingApp<O extends RootModuleDefinition>(options: O, entities: ClassType[] = [], setup?: (module: AppModule<any>) => void): TestingFacade<App<O>> {
    const module = new RootAppModule(options);

    module.setupGlobalProvider<Logger>().removeTransport(injectorReference(ConsoleTransport));
    module.setupGlobalProvider<Logger>().addTransport(injectorReference(MemoryLoggerTransport));

    module.addProvider({ provide: WebWorkerFactory, useClass: WebMemoryWorkerFactory }); //don't start HTTP-server
    module.addProvider({ provide: BrokerServer, useExisting: BrokerMemoryServer }); //don't start Broker TCP-server
    module.addProvider(BrokerMemoryServer);
    module.addProvider(MemoryLoggerTransport);
    module.addProvider({
        provide: BrokerDeepkitAdapter, useFactory: (server: BrokerMemoryServer) => {
            const transport = new RpcDirectClientAdapter(server.kernel);
            return new BrokerDeepkitAdapter({ servers: [{ url: '', transport }] });
        }
    });
    module.addProvider({ provide: BrokerCache, useFactory: (adapter: BrokerDeepkitAdapter) => new BrokerCache(adapter) });
    module.addProvider({ provide: BrokerLock, useFactory: (adapter: BrokerDeepkitAdapter) => new BrokerLock(adapter) });
    module.addProvider({ provide: BrokerQueue, useFactory: (adapter: BrokerDeepkitAdapter) => new BrokerQueue(adapter) });
    module.addProvider({ provide: BrokerBus, useFactory: (adapter: BrokerDeepkitAdapter) => new BrokerBus(adapter) });
    module.addProvider({ provide: DebugBrokerBus, useFactory: (adapter: BrokerDeepkitAdapter) => new BrokerBus(adapter) });

    if (!module.hasImport(FrameworkModule)) module.addImportAtBeginning(new FrameworkModule);

    if (entities.length) {
        module.addProvider({ provide: Database, useValue: new Database(new MemoryDatabaseAdapter, entities) });
        module.setupGlobalProvider<DatabaseRegistry>().addDatabase(Database, {}, module);
    }

    if (setup) module.setup(setup as any);

    return new TestingFacade(App.fromModule(module));
}
