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

import { binaryTypes, CompilerState, PropertySchema } from '@deepkit/type';
import { sqlSerializer } from '@deepkit/sql';

export const mySqlSerializer = new class extends sqlSerializer.fork('mysql') {
};

//for queries with `returning`, MySQL returns binary stuff as base64.
function convertBinaryFromBase64(property: PropertySchema, state: CompilerState) {
    state.setContext({ Buffer });
    const offset = 'base64:type254:'.length;
    state.addSetter(`typeof ${state.accessor} === 'string' && ${state.accessor}.startsWith('base64:') ? Buffer.from(${state.accessor}.substr(${offset}), 'base64') : ${state.accessor}`);
}

mySqlSerializer.toClass.prepend('uuid', convertBinaryFromBase64)
mySqlSerializer.toClass.prepend('arrayBuffer', convertBinaryFromBase64)
for (const type of binaryTypes) {
    mySqlSerializer.toClass.prepend(type, convertBinaryFromBase64)
}
