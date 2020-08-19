import {hornet} from '@super-hornet/framework-server-common';
import {FsConfig} from './fs.config';
import {Database, DatabaseAdapter} from '@super-hornet/marshal-orm';
import {HornetFile} from '@super-hornet/framework-shared';

@hornet.module({
    providers: [
        FsConfig,
        Database,
    ],
    exports: [
        FsConfig,
        Database,
    ]
})
export class FSModule {
    constructor(database: Database<DatabaseAdapter>) {
        database.registerEntity(HornetFile);
    }
}
