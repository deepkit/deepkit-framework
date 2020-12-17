/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import {createModule} from '../module';
import {MigrationCreateController} from './cli/migration-create-command';
import {MigrationUpCommand} from './cli/migration-up-command';
import {MigrationPendingCommand} from './cli/migration-pending-command';
import {MigrationDownCommand} from './cli/migration-down-command';
import {inject, injectable} from '../injector/injector';
import {DatabaseRegistry} from './database-registry';
import {MigrationProvider} from './migration-provider';
import {databaseConfig} from './database.config';
import {eventDispatcher} from '../event';
import {onServerMainBootstrap, onServerMainShutdown, onServerWorkerBootstrap} from '../application-server';
import {Logger} from '../logger';

@injectable()
export class DatabaseListener {
    constructor(
        protected databases: DatabaseRegistry,
        protected logger: Logger,
    ) {
    }

    @eventDispatcher.listen(onServerMainBootstrap)
    async onMainBootstrap() {
        for (const databaseType of this.databases.getDatabaseTypes()) {
            if (this.databases.isMigrateOnStartup(databaseType)) {
                const database = this.databases.getDatabase(databaseType);
                if (!database) throw new Error('Database not created');
                this.logger.log(`Migrate database <yellow>${database.name}</yellow>`);
                await database.migrate();
            }
        }
    }

    @eventDispatcher.listen(onServerMainShutdown)
    onShutdown() {
        this.databases.onShutDown();
    }
}

export const DatabaseModule = createModule({
    name: 'database',
    providers: [
        DatabaseRegistry,
        MigrationProvider,
    ],
    listeners: [
        DatabaseListener,
    ],
    controllers: [
        MigrationCreateController,
        MigrationUpCommand,
        MigrationPendingCommand,
        MigrationDownCommand
    ],
    config: databaseConfig
}).setup((module, config) => {
    module.options.providers.push(...config.databases);
}).forRoot();
