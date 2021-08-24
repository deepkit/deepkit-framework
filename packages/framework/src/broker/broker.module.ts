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
import { injectable } from '@deepkit/injector';
import { eventDispatcher } from '@deepkit/event';
import { onServerMainBootstrap, onServerMainShutdown } from '../application-server';
import { brokerConfig } from './broker.config';
import { Broker, BrokerServer } from './broker';
import { Logger } from '@deepkit/logger';

class BrokerStartConfig extends brokerConfig.slice('startOnBootstrap', 'listen') {
}

@injectable()
export class BrokerListener {
    constructor(
        protected logger: Logger,
        protected broker: Broker,
        protected brokerServer: BrokerServer,
        protected config: BrokerStartConfig,
    ) {
    }

    @eventDispatcher.listen(onServerMainBootstrap)
    async onMainBootstrap() {
        if (this.config.startOnBootstrap) {
            await this.brokerServer.start();
            this.logger.log(`Broker started at <green>${this.config.listen}</green>`);
        }
    }

    @eventDispatcher.listen(onServerMainShutdown)
    async onMainShutdown() {
        if (this.config.startOnBootstrap) {
            this.brokerServer.close();
        }
        await this.broker.disconnect();
    }
}

export class BrokerModule extends createModule({
    listeners: [
        BrokerListener
    ],
    config: brokerConfig,
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
}, 'broker') {}
