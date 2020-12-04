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

import {cli, Command, flag} from '../command';
import {Logger, TimestampFormatter} from '../logger';
import {kernelConfig} from '../kernel.config';
import {ApplicationServer} from '../application-server';
import {WebWorkerFactory} from '../worker';
import {EventDispatcher} from '../event';

class ApplicationServerConfig extends kernelConfig.slice(['server', 'port', 'host', 'workers']) {}

@cli.controller('server:listen', {
    description: 'Starts the HTTP server'
})
export class ServerListenController implements Command {
    constructor(
        protected logger: Logger,
        protected config: ApplicationServerConfig,
        protected webWorkerFactory: WebWorkerFactory,
        protected eventDispatcher: EventDispatcher,
    ) {
    }

    async execute(
        @flag.optional.default('localhost') host?: string,
        @flag.optional port?: number,
        @flag.optional workers?: number,
    ): Promise<void> {
        if (!this.logger.hasFormatter(TimestampFormatter)) this.logger.addFormatter(new TimestampFormatter);

        const applicationServer = new ApplicationServer(this.logger, this.webWorkerFactory, this.eventDispatcher, {
                workers: 1,
                host: host || this.config.host,
                port: port || this.config.port,
                server: this.config.server,
        });

        await applicationServer.start();
    }
}
