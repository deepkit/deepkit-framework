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

import {FsConfig} from './fs.config';
import {Database, DatabaseAdapter} from '@deepkit/orm';
import {createModule, injectable} from '@deepkit/framework';
import {DeepkitFile} from '@deepkit/framework-shared';

@injectable()
export class FsModuleBootstrap {
    constructor(database: Database<DatabaseAdapter>) {
        database.registerEntity(DeepkitFile);
    }
}

export const FSModule = createModule({
    name: 'fs',
    bootstrap: FsModuleBootstrap,
    providers: [
        FsConfig,
        Database,
    ],
    exports: [
        FsConfig,
        Database,
    ]
});
