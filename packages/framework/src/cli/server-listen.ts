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

import {ApplicationServer} from '../application-server';
import {cli, Command, flag} from '../command';
import {ApplicationConfig} from '../application-config';
import {Logger, TimestampFormatter} from '../logger';

@cli.controller('server:listen', {
    description: 'Starts the HTTP server'
})
export class ServerListenController implements Command {
    constructor(
        protected logger: Logger,
        protected applicationServer: ApplicationServer,
        protected config: ApplicationConfig,
    ) {
    }

    async execute(
        @flag.optional.default('localhost') host?: string,
        @flag.optional port?: number
    ): Promise<void> {
        if (host) this.config.host = host;
        if (port) this.config.port = port;

        if (!this.logger.hasFormatter(TimestampFormatter)) this.logger.addFormatter(new TimestampFormatter);

        await this.applicationServer.start();
    }
}
