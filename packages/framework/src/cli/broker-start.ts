import { cli, Command } from '@deepkit/app';
import { BrokerServer } from '../broker/broker.js';

/**
 * @description Starts the broker server manually.
 */
@cli.controller('server:broker:start')
export class ServerStartController implements Command {
    constructor(
        protected server: BrokerServer,
    ) {
    }

    async execute(): Promise<void> {
        await this.server.start();
    }
}
