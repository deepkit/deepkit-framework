import {hornet} from '@deepkit/framework';
import {FsConfig} from './fs.config';
import {Database, DatabaseAdapter} from '@deepkit/marshal-orm';
import {HornetFile} from '@deepkit/framework-shared';

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
