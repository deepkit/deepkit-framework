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
import { BrokerConfig } from '../module.config.js';
import { BrokerDeepkitAdapter } from '@deepkit/broker';
import { StopwatchStore } from '@deepkit/stopwatch';

export class BrokerListener {
    constructor(
        protected logger: LoggerInterface,
        protected broker: BrokerDeepkitAdapter,
        protected brokerServer: BrokerServer,
        protected store: StopwatchStore,
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
        await this.store.close();
        if (this.startOnBootstrap) {
            this.brokerServer.close();
        }
        await this.broker.disconnect();
    }
}
