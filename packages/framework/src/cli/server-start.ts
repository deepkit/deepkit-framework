/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ApplicationServer } from '../application-server';
import { AppModule, cli, Command, flag } from '@deepkit/app';
import { InjectorContext } from '@deepkit/injector';
import { DefaultFormatter, Logger } from '@deepkit/logger';
import { FrameworkModule } from '../module';

@cli.controller('server:start', {
    description: 'Starts the application server. If HTTP or RPC controllers or a publicDir are provided this will include an HTTP listener'
})
export class ServerStartController implements Command {
    constructor(
        protected logger: Logger,
        protected injectorContext: InjectorContext,
    ) {
    }

    async execute(
        @flag.optional host?: string,
        @flag.optional port?: number,
        @flag.optional workers?: number,
        @flag.optional ssl?: boolean,
        @flag.optional selfSigned?: boolean,
    ): Promise<void> {
        if (!this.logger.hasFormatters()) this.logger.addFormatter(new DefaultFormatter);

        const overwrite: { [name: string]: any } = {};
        if (host) overwrite.host = host;
        if (port) overwrite.port = port;
        if (workers) overwrite.workers = workers;
        if (ssl) overwrite.ssl = {};
        if (selfSigned) overwrite.selfSigned = selfSigned;

        const kernel = this.injectorContext.getModuleForModuleClass(FrameworkModule) as AppModule<any>;
        kernel.setConfig(overwrite);
        const server = this.injectorContext.get(ApplicationServer);

        await server.start(true);
    }
}
