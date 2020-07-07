import {ProcessLocker} from "@super-hornet/core";
import {InternalClient} from "./internal-client";
import {Configuration} from "./configuration";
import {Module} from "@super-hornet/framework-server-common";
import {ExchangeModule} from "@super-hornet/exchange";
import {SessionStack} from "./application";
import {ClientConnection} from "./client-connection";
import {ConnectionMiddleware} from "@super-hornet/framework-shared";

@Module({
    providers: [
        ProcessLocker,
        InternalClient,
        Configuration,

        {provide: SessionStack, scope: 'session'},
        {provide: ClientConnection, scope: 'session'},
        {provide: ConnectionMiddleware, scope: 'session'},
    ],
    imports: [
        ExchangeModule
    ]
})
export class HornetBaseModule {
}
