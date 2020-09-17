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
