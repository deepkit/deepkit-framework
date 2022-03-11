/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { AppLocker } from './app-locker';
import { createModule } from '@deepkit/app';
import { eventDispatcher } from '@deepkit/event';
import { onServerMainBootstrap, onServerMainShutdown } from '../application-server';
import { BrokerConfig } from './broker.config';
import { Broker, BrokerServer } from './broker';
import { LoggerInterface } from '@deepkit/logger';

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
            this.logger.log(`Broker started at <green>${this.listen}</green>`);
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

export class BrokerModule extends createModule({
    listeners: [
        BrokerListener
    ],
    config: BrokerConfig,
    providers: [
        Broker,
        AppLocker,
        BrokerServer,
    ],
    exports: [
        Broker,
        AppLocker,
        BrokerServer,
    ]
}, 'broker') {
}
