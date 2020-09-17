import {deepkit, DynamicModule} from '@deepkit/framework';
import {MigrationCreateController} from './cli/migration-create-command';
import {Database} from '@deepkit/orm';
import {DatabaseProvider} from './provider';
import {ClassType} from '@deepkit/core';
import {MigrationPendingCommand} from './cli/migration-pending-command';
import {MigrationUpCommand} from './cli/migration-up-command';


@deepkit.module({
    controllers: [
        MigrationCreateController,
        MigrationPendingCommand,
        MigrationUpCommand,
    ]
})
export class OrmModule {
    static forDatabases(...databases: ClassType<Database<any>>[]): DynamicModule {
        return {
            root: true,
            module: OrmModule,
            providers: [
                {provide: 'orm.databases', useValue: databases},
                DatabaseProvider,
            ]
        };
    }
}
