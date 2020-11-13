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

import {ExchangeServer, ExchangeServerFactory} from './exchange-server';
import {Exchange} from './exchange';
import {AppLocker} from './app-locker';
import {ExchangeConfig} from './exchange.config';
import {ModuleBootstrap} from '../decorator';
import {injectable} from '../injector/injector';
import {createModule} from '../module';

@injectable()
export class ExchangeModuleBootstrap implements ModuleBootstrap {
    protected exchangeServer?: ExchangeServer;

    constructor(
        protected config: ExchangeConfig,
        protected exchangeServerFactory: ExchangeServerFactory,
    ) {
    }

    async onBootstrapServer(): Promise<void> {
        if (this.config.startOnBootstrap) {
            this.exchangeServer = this.exchangeServerFactory.create(this.config.hostOrUnixPath);
            await this.exchangeServer.start();
        }
    }

    onShutDown(): Promise<void> | void {
        if (this.config.startOnBootstrap && this.exchangeServer) {
            this.exchangeServer.close();
            this.exchangeServer = undefined;
        }
    }
}

export const ExchangeModule = createModule({
    name: 'exchange',
    bootstrap: ExchangeModuleBootstrap,
    providers: [
        ExchangeServerFactory,
        Exchange,
        AppLocker,
        ExchangeConfig,
    ],
    exports: [
        ExchangeServerFactory,
        Exchange,
        AppLocker,
        ExchangeConfig,
    ]
});
