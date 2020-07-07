import {ProcessLocker} from "./process-locker";
import {InternalClient} from "./internal-client";
import {Configuration} from "./configuration";
import {Module} from "@super-hornet/framework-server-common";
import {ExchangeModule} from "@super-hornet/exchange";

@Module({
    providers: [
        ProcessLocker,
        InternalClient,
        Configuration,
    ],
    imports: [
        ExchangeModule
    ]
})
export class HornetBaseModule {
}
