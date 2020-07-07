import {ExchangeServer} from "./exchange-server";
import {Exchange} from './exchange';
import {AppLocker} from "./app-locker";
import {Module, SuperHornetModule} from "@super-hornet/framework-server-common";

@Module({
    providers: [
        ExchangeServer,
        Exchange,
        AppLocker,
    ]
})
export class ExchangeModule implements SuperHornetModule {
    bootstrap(): Promise<void> | void {
        return undefined;
    }
}
