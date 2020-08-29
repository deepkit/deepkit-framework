import {ProcessLocker} from '@super-hornet/core';
import {InternalClient} from './internal-client';
import {Configuration} from './configuration';
import {DynamicModule, hornet} from '@super-hornet/framework-server-common';
import {ExchangeModule} from '@super-hornet/exchange';
import {SessionStack} from './application';
import {ClientConnection} from './client-connection';
import {ConnectionMiddleware} from '@super-hornet/framework-shared';
import {SecurityStrategy} from './security';
import {Router} from './router';
import {HttpHandler} from './http';

@hornet.module({
    providers: [
        ProcessLocker,
        InternalClient,
        Configuration,
        SecurityStrategy,
        Router,
        HttpHandler,
        {provide: SessionStack, scope: 'session'},
        {provide: ClientConnection, scope: 'session'},
        {provide: ConnectionMiddleware, scope: 'session'},
    ],
    imports: [
        ExchangeModule
    ],
})
export class SuperHornetBaseModule {
    static forRoot(): DynamicModule {
        return {
            root: true,
            module: SuperHornetBaseModule,
        };
    }
}
