import { AppModule } from '@deepkit/app';
import { ConsoleTransport, Logger } from '@deepkit/logger';
import { InjectorContext } from '@deepkit/injector';
import { DatabaseRegistry } from '@deepkit/orm';
import { MigrationCreateController } from './cli/migration-create-command';
import { MigrationDownCommand } from './cli/migration-down-command';
import { MigrationUpCommand } from './cli/migration-up-command';
import { MigrationPendingCommand } from './cli/migration-pending-command';
import { MigrationProvider } from './migration/migration-provider';

export const appModule = new AppModule({
    providers: [
        MigrationProvider,
        { provide: DatabaseRegistry, deps: [InjectorContext], useFactory: (ic) => new DatabaseRegistry(ic) },
        { provide: Logger, useValue: new Logger([new ConsoleTransport]) }
    ],
    controllers: [
        MigrationCreateController,
        MigrationDownCommand,
        MigrationUpCommand,
        MigrationPendingCommand,
    ]
});
