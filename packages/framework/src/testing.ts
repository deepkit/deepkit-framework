/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { BrokerKernel } from '@deepkit/broker';
import { ClassType } from '@deepkit/core';
import { ConsoleTransport, Logger, MemoryLoggerTransport } from '@deepkit/logger';
import { Database, DatabaseRegistry, MemoryDatabaseAdapter } from '@deepkit/orm';
import { ApplicationServer } from './application-server.js';
import { Broker, BrokerServer, DirectBroker } from './broker/broker.js';
import { injectorReference } from '@deepkit/injector';
import { App, AppModule, RootAppModule, RootModuleDefinition } from '@deepkit/app';
import { WebMemoryWorkerFactory, WebWorkerFactory } from './worker.js';
import { HttpKernel, MemoryHttpResponse, RequestBuilder } from '@deepkit/http';
import { RpcClient } from '@deepkit/rpc';
import { FrameworkModule } from './module.js';

/**
 * @deprecated use {@link MemoryHttpResponse} instead
 */
export class TestHttpResponse extends MemoryHttpResponse {
}

export class TestingFacade<A extends App<any>> {
    constructor(public app: A) {
    }

    public async startServer() {
        await this.app.get(ApplicationServer).start();
    }

    public async stopServer() {
        await this.app.get(ApplicationServer).close();
    }

    public async request(requestBuilder: RequestBuilder): Promise<MemoryHttpResponse> {
        const request = requestBuilder.build();
        const response = new MemoryHttpResponse(request);
        await this.app.get(HttpKernel).handleRequest(request, response);
        return response;
    }

    public createRpcClient(): RpcClient {
        return this.app.get(ApplicationServer).createClient();
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
    module.addProvider({ provide: BrokerServer, useClass: BrokerMemoryServer }); //don't start Broker TCP-server
    module.addProvider(BrokerMemoryServer);
    module.addProvider(MemoryLoggerTransport);
    module.addProvider({
        provide: Broker, useFactory: (server: BrokerMemoryServer) => {
            return new DirectBroker(server.kernel);
        }
    });

    if (!module.hasImport(FrameworkModule)) module.addImportAtBeginning(new FrameworkModule)

    if (entities.length) {
        module.addProvider({ provide: Database, useValue: new Database(new MemoryDatabaseAdapter, entities) });
        module.setupGlobalProvider<DatabaseRegistry>().addDatabase(Database, {}, module);
    }

    if (setup) module.setup(setup as any);

    return new TestingFacade(App.fromModule(module));
}
