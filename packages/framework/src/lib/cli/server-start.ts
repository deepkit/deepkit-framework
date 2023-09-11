/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ApplicationServer } from '../application-server.js';
import { AppModule, cli, Command, flag, ServiceContainer } from '@deepkit/app';
import { DefaultFormatter, Logger, LoggerInterface } from '@deepkit/logger';
import { FrameworkModule } from '../module.js';

@cli.controller('server:start', {
    description: 'Starts the application server. If HTTP or RPC controllers or a publicDir are provided this will include an HTTP listener'
})
export class ServerStartController implements Command {
    constructor(
        protected logger: LoggerInterface,
        protected serviceContainer: ServiceContainer,
    ) {
    }

    async execute(
        @flag host?: string,
        @flag port?: number,
        @flag workers?: number,
        @flag ssl?: boolean,
        @flag selfSigned?: boolean,
    ): Promise<void> {
        if (this.logger instanceof Logger) {
            if (!this.logger.hasFormatters()) this.logger.addFormatter(new DefaultFormatter);
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
