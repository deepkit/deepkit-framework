import { cli, Command } from '@deepkit/app';
import { BrokerServer } from '../broker/broker.js';

@cli.controller('broker:start', {
    description: 'Starts the broker server manually'
})
export class ServerStartController implements Command {
    constructor(
        protected server: BrokerServer,
    ) {
    }

    async execute(): Promise<void> {
        await this.server.start();
    }
}
