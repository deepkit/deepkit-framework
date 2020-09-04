import {ProcessLocker} from '@super-hornet/core';
import {InternalClient} from './internal-client';
import {Configuration} from './configuration';
import {SessionStack} from './session';
import {ClientConnection} from './client-connection';
import {ConnectionMiddleware} from '@super-hornet/framework-shared';
import {SecurityStrategy} from './security';
import {Router} from './router';
import {HttpHandler} from './http';
import {ServerListenController} from './cli/server-listen';
import {DynamicModule, hornet} from './decorator';
import {ExchangeModule} from './exchange/exchange.module';
import {ApplicationServer} from './application-server';

@hornet.module({
    providers: [
        ProcessLocker,
        InternalClient,
        Configuration,
        SecurityStrategy,
        ApplicationServer,
        Router,
        HttpHandler,
        {provide: SessionStack, scope: 'session'},
        {provide: ClientConnection, scope: 'session'},
        {provide: ConnectionMiddleware, scope: 'session'},
    ],
    controllers: [
        ServerListenController,
    ],
    imports: [
        ExchangeModule
    ],
    exports: [
        ExchangeModule
    ],
})
export class SuperHornetBaseModule {
    constructor(configuration: Configuration) {
        configuration.loadEnvFile('.env');
    }

    static forRoot(): DynamicModule {
        return {
            root: true,
            module: SuperHornetBaseModule,
        };
    }
}
