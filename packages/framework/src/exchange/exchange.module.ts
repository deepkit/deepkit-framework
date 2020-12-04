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

import {ExchangeServer} from './exchange-server';
import {Exchange} from './exchange';
import {AppLocker} from './app-locker';
import {createModule} from '../module';
import {inject, injectable} from '../injector/injector';
import {eventDispatcher} from '../event';
import {onServerBootstrap, onServerShutdown} from '../application-server';
import {exchangeConfig} from './exchange.config';

@injectable()
export class ExchangeListener {
    protected exchangeServer?: ExchangeServer;

    constructor(
        protected exchange: Exchange,
        @inject(exchangeConfig.token('listen')) protected listen: string,
        @inject(exchangeConfig.token('startOnBootstrap')) protected startOnBootstrap: boolean,
    ) {
    }

    @eventDispatcher.listen(onServerBootstrap)
    async onBootstrap() {
        if (this.startOnBootstrap) {
            this.exchangeServer = new ExchangeServer(this.listen);
            await this.exchangeServer.start();
        }
    }

    @eventDispatcher.listen(onServerShutdown)
    async onShutdown() {
        if (this.startOnBootstrap && this.exchangeServer) {
            this.exchangeServer.close();
            this.exchangeServer = undefined;
        }
        await this.exchange.disconnect();
    }
}

export const ExchangeModule = createModule({
    name: 'exchange',
    listeners: [
        ExchangeListener
    ],
    config: exchangeConfig,
    providers: [
        Exchange,
        AppLocker,
    ],
    exports: [
        Exchange,
        AppLocker,
    ]
}).forRoot();
