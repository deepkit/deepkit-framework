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
import {injectable} from '../injector/injector';
import {Databases} from './databases';
import {ModuleBootstrap} from '../decorator';
import {MigrationProvider} from './migration-provider';
import {createConfig} from '../injector/injector';
import {t} from '@deepkit/type';

export const DatabaseConfig = createConfig({
    databases: t.array(t.any),
    migrateOnStartup: t.boolean.default(false),
});

@injectable()
export class DatabaseBootstrap implements ModuleBootstrap {
    constructor(
        protected databases: Databases,
    ) {
        this.databases.init();
    }

    onBootstrap(): void {
        // if (options && options.migrateOnStartup) {
        //     for (const database of this.databases.getDatabases()) {
        //         database.migrate();
        //     }
        // }
    }

    onShutDown() {
        this.databases.onShutDown();
    }
}

export const DatabaseModule = createModule({
    name: 'database',
    bootstrap: DatabaseBootstrap,
    providers: [
        Databases,
        MigrationProvider,
    ],
    controllers: [
        MigrationCreateController,
        MigrationUpCommand,
        MigrationPendingCommand,
        MigrationDownCommand
    ],
    config: DatabaseConfig
}).forRoot();
