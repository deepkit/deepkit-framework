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

import { AppLocker } from './app-locker';
import { createModule } from '../module';
import { inject, injectable } from '../injector/injector';
import { eventDispatcher } from '../event';
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

export const BrokerModule = createModule({
    name: 'exchange',
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
}).forRoot();
