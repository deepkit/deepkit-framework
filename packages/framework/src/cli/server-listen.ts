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
import { cli, Command, flag } from '@deepkit/app';
import { InjectorContext } from '@deepkit/injector';
import { Logger, TimestampFormatter } from '@deepkit/logger';

@cli.controller('server:listen', {
    description: 'Starts the HTTP server'
})
export class ServerListenController implements Command {
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
        @flag.default(false) watch?: boolean,
    ): Promise<void> {
        if (!this.logger.hasFormatter(TimestampFormatter)) this.logger.addFormatter(new TimestampFormatter);

        const overwrite: { [name: string]: any } = {};
        if (host) overwrite.host = host;
        if (port) overwrite.port = port;
        if (workers) overwrite.workers = workers;
        if (ssl) overwrite.ssl = {};
        if (selfSigned) overwrite.selfSigned = selfSigned;

        const kernel = this.injectorContext.getModule('kernel');
        kernel.setConfig(overwrite);
        const server = this.injectorContext.get(ApplicationServer);

        await server.start();
    }
}
