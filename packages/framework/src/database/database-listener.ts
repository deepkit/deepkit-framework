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

import { getClassName } from '@deepkit/core';
import { onServerMainBootstrap, onServerMainShutdown } from '../application-server';
import { DatabaseRegistry } from '../database-registry';
import { eventDispatcher } from '../event';
import { injectable } from '../injector/injector';
import { Logger } from '../logger';

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
