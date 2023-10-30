/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { eventDispatcher } from '@deepkit/event';
import { onServerMainBootstrap, onServerMainShutdown } from '../application-server.js';
import { BrokerServer } from './broker.js';
import { LoggerInterface } from '@deepkit/logger';
import { Broker } from '@deepkit/broker';
import { BrokerConfig } from '../module.config.js';

export class BrokerListener {
    constructor(
        protected logger: LoggerInterface,
        protected broker: Broker,
        protected brokerServer: BrokerServer,
        protected listen: BrokerConfig['listen'],
        protected startOnBootstrap: BrokerConfig['startOnBootstrap'],
    ) {
    }

    @eventDispatcher.listen(onServerMainBootstrap)
    async onMainBootstrap() {
        if (this.startOnBootstrap) {
            await this.brokerServer.start();
            this.logger.log(`Broker started at <green>${this.listen}</green>. Disable with "FrameworkModule({broker: {startOnBootstrap: false}})"`);
        }
    }

    @eventDispatcher.listen(onServerMainShutdown)
    async onMainShutdown() {
        if (this.startOnBootstrap) {
            this.brokerServer.close();
        }
        await this.broker.disconnect();
    }
}
