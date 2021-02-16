import { createModule } from '@deepkit/command';
import { MigrationCreateController } from './cli/migration-create-command';
import { MigrationDownCommand } from './cli/migration-down-command';
import { MigrationUpCommand } from './cli/migration-up-command';
import { MigrationPendingCommand } from './cli/migration-pending-command';
import { MigrationProvider } from './migration/migration-provider';
import { DatabaseRegistry } from '@deepkit/orm';
import { ConsoleTransport, Logger } from '@deepkit/logger';
import { InjectorContext } from '@deepkit/injector';

export const appModule = createModule({
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
