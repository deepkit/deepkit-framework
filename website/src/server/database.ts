import { BenchmarkRun } from '@app/common/benchmark';
import { CommunityMessage, CommunityMessageVote, DocPageContent } from '@app/common/models';
import { AppConfig } from '@app/server/config';

import { Database } from '@deepkit/orm';
import { PostgresDatabaseAdapter } from '@deepkit/postgres';

type DbConfig = Pick<AppConfig, 'databaseHost' | 'databaseName' | 'databasePort' | 'databaseUser' | 'databasePassword'>;

export class MainDatabase extends Database {
    constructor(config: DbConfig) {
        super(
            new PostgresDatabaseAdapter({
                database: config.databaseName,
                host: config.databaseHost,
                password: config.databasePassword,
                port: config.databasePort,
                user: config.databaseUser,
            }),
            [CommunityMessage, CommunityMessageVote, DocPageContent, BenchmarkRun],
        );
    }
}
