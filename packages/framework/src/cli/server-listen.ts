/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { ApplicationServer } from '../application-server';
import { cli, Command, flag } from '../command';
import { InjectorContext } from '../injector/injector';
import { KernelModule } from '../kernel';
import { Logger, TimestampFormatter } from '../logger';

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
