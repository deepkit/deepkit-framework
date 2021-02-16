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
import { AppModule } from '@deepkit/app';
import { inject, injectable } from '@deepkit/injector';
import { eventDispatcher } from '@deepkit/event';
import { onServerMainBootstrap, onServerMainShutdown } from '../application-server';
import { brokerConfig } from './broker.config';
import { Broker, BrokerServer } from './broker';

@injectable()
export class BrokerListener {
    constructor(
        protected broker: Broker,
        protected brokerServer: BrokerServer,
        @inject(brokerConfig.token('startOnBootstrap')) protected startOnBootstrap: boolean,
    ) {
    }

    @eventDispatcher.listen(onServerMainBootstrap)
    async onMainBootstrap() {
        if (this.startOnBootstrap) {
            await this.brokerServer.start();
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

export const BrokerModule = new AppModule({
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
}, 'broker').forRoot();
