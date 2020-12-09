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

import {plainToClass, t} from '@deepkit/type';
import {buildChanges, getInstanceState, getJITConverterForSnapshot} from '@deepkit/orm';
import {BenchSuite} from '../bench';

export async function main() {
    const schema = t.schema({
        id: t.number.primary,
        name: t.string,
        priority: t.number,
        tags: t.array(t.string),
        ready: t.boolean
    });

    const item = plainToClass(schema, {id: 0, name: 'Peter', priority: 4, tags: ['a', 'b', 'c'], ready: true});

    const bench = new BenchSuite('change-detection');
    const createSnapshot = getJITConverterForSnapshot(schema);

    bench.add('create-snapshot', () => {
        const bla = createSnapshot(item);
    });

    getInstanceState(item).markAsPersisted();
    item.name = 'Alex';
    item.tags = ['a', 'b', 'c'];
    bench.add('build-changeSet', () => {
        buildChanges(item);
    });

    bench.run();
}
