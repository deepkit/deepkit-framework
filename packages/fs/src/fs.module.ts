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

import {deepkit} from '@deepkit/framework';
import {FsConfig} from './fs.config';
import {Database, DatabaseAdapter} from '@deepkit/orm';
import {HornetFile} from '@deepkit/framework-shared';

@deepkit.module({
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
