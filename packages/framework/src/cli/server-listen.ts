import {ApplicationServer} from '../application-server';
import {cli, Command, flag} from '../command';
import {ApplicationConfig} from '../application-config';

@cli.controller('server:listen', {
    description: 'Starts the HTTP server'
})
export class ServerListenController implements Command {
    constructor(
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

        await this.applicationServer.start();
    }
}