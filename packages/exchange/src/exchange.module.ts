import {HornetModule, Module} from "@super-hornet/framework-server";
import {Exchange} from "./exchange";
import {ExchangeServer} from "./exchange-server";
import {AppLocker} from "./app-locker";

@Module({
    providers: [
        ExchangeServer,
        Exchange,
        AppLocker,
    ]
})
export class ExchangeModule implements HornetModule {
    bootstrap(): Promise<void> | void {
        return undefined;
    }
}
