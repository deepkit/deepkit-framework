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
import {MigrationProvider} from './migration-provider';
import {MigrationCreateController} from './cli/orm/migration-create-command';
import {MigrationUpCommand} from './cli/orm/migration-up-command';
import {MigrationPendingCommand} from './cli/orm/migration-pending-command';
import {MigrationDownCommand} from './cli/orm/migration-down-command';
import {Databases} from './databases';
import {LiveDatabase} from './exchange/live-database';

@deepkit.module({
    providers: [
        ProcessLocker,
        InternalClient,
        SecurityStrategy,
        ApplicationServer,
        Router,
        HttpHandler,
        MigrationProvider,
        Databases,
        {provide: Logger, useFactory: () => new Logger([new ConsoleTransport()], [])},
        {provide: SessionStack, scope: 'session'},
        {provide: ClientConnection, scope: 'session'},
        {provide: ConnectionMiddleware, scope: 'session'},
        {provide: LiveDatabase, scope: 'session'},
    ],
    controllers: [
        ServerListenController,
        MigrationCreateController,
        MigrationUpCommand,
        MigrationPendingCommand,
        MigrationDownCommand
    ],
    imports: [
        ExchangeModule,
    ],
})
export class BaseModule {
    constructor(protected databases: Databases) {
        databases.init();
    }

    static forRoot(): DynamicModule {
        const imports: any[] = [];

        return {
            root: true,
            module: BaseModule,
            imports: imports,
        };
    }
}
