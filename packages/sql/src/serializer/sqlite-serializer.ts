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

import { sqlSerializer } from './sql-serializer';

export const SqliteSerializer = new class extends sqlSerializer.fork('sqlite') {
};

SqliteSerializer.fromClass.register('date', (property, state) => {
    state.addSetter(`${state.accessor}.toJSON();`);
});


SqliteSerializer.fromClass.register('boolean', (property, state) => {
    state.addSetter(`${state.accessor} ? 1 : 0`);
});

SqliteSerializer.toClass.register('boolean', (property, state) => {
    state.addSetter(`${state.accessor} === 1`);
});
