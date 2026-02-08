/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { AppModule, Command, Flag, ServiceContainer, cli } from '@deepkit/app';
import { DefaultFormatter, Logger, LoggerInterface } from '@deepkit/logger';

import { ApplicationServer } from '../application-server.js';
import { FrameworkModule } from '../module.js';

/**
 * @description Starts the application server. If HTTP or RPC controllers or a publicDir are provided this will include an HTTP listener.
 */
@cli.controller('server:start')
export class ServerStartController implements Command {
    constructor(
        protected logger: LoggerInterface,
        protected serviceContainer: ServiceContainer,
    ) {}

    async execute(
        host?: string & Flag,
        port?: number & Flag,
        workers?: number & Flag,
        ssl?: boolean & Flag,
        selfSigned?: boolean & Flag,
    ): Promise<void> {
        if (this.logger instanceof Logger) {
            if (!this.logger.hasFormatters()) this.logger.addFormatter(new DefaultFormatter());
        }

        const overwrite: { [name: string]: any } = {};
        if (host) overwrite.host = host;
        if (port) overwrite.port = port;
        if (workers) overwrite.workers = workers;
        if (ssl) overwrite.ssl = {};
        if (selfSigned) overwrite.selfSigned = selfSigned;

        const kernel = this.serviceContainer.getModule(FrameworkModule) as AppModule<any>;
        kernel.configure(overwrite);
        const server = this.serviceContainer.getRootInjector().get(ApplicationServer);

        await server.start(true);
    }
}
