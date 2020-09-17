import {ProcessLocker} from '@deepkit/core';
import {InternalClient} from './internal-client';
import {SessionStack} from './session';
import {ClientConnection} from './client-connection';
import {ConnectionMiddleware} from '@deepkit/framework-shared';
import {SecurityStrategy} from './security';
import {Router} from './router';
import {HttpHandler} from './http';
import {ServerListenController} from './cli/server-listen';
import {deepkit, DynamicModule} from './decorator';
import {ExchangeModule} from './exchange/exchange.module';
import {ApplicationServer} from './application-server';
import {ConsoleTransport, Logger} from './logger';

@deepkit.module({
    providers: [
        ProcessLocker,
        InternalClient,
        SecurityStrategy,
        ApplicationServer,
        Router,
        HttpHandler,
        {provide: Logger, useFactory: () => new Logger([new ConsoleTransport()], [])},
        {provide: SessionStack, scope: 'session'},
        {provide: ClientConnection, scope: 'session'},
        {provide: ConnectionMiddleware, scope: 'session'},
    ],
    controllers: [
        ServerListenController,
    ],
    imports: [
        ExchangeModule,
    ],
})
export class BaseModule {
    static forRoot(): DynamicModule {
        const imports: any[] = [];

        return {
            root: true,
            module: BaseModule,
            imports: imports,
        };
    }
}
