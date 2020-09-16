import {deepkit, DynamicModule} from '@deepkit/framework';
import {MigrationCreateController} from './cli/migration-create-command';
import {Database} from '@deepkit/orm';
import {DatabaseProvider} from './provider';
import {ClassType} from '@deepkit/core';


@deepkit.module({
    controllers: [MigrationCreateController]
})
export class OrmModule {
    static forDatabases(...databases: ClassType<Database<any>>[]): DynamicModule {
        return {
            root: true,
            module: OrmModule,
            providers: [
                {provide: DatabaseProvider, useValue: new DatabaseProvider(databases)},
            ]
        };
    }
}
