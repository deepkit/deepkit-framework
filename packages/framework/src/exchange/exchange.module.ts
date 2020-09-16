import {ExchangeServer, ExchangeServerFactory} from './exchange-server';
import {Exchange} from './exchange';
import {AppLocker} from './app-locker';
import {ExchangeConfig} from './exchange.config';
import {deepkit, SuperHornetModule} from '../decorator';

@deepkit.module({
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
})
export class ExchangeModule implements SuperHornetModule {
    protected exchangeServer?: ExchangeServer;

    constructor(
        protected config: ExchangeConfig,
        protected exchangeServerFactory: ExchangeServerFactory
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
