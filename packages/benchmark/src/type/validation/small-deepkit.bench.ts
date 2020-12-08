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

import {t, validateFactory} from '@deepkit/type';
import {good} from './validation';
import {BenchSuite} from '../../bench';

const Model = t.schema({
    number: t.number,
    negNumber: t.number.negative(),
    maxNumber: t.number.maximum(500),
    strings: t.array(t.string),
    longString: t.string,
    boolean: t.boolean,
    deeplyNested: t.type({
        foo: t.string,
        num: t.number,
        bool: t.boolean
    })
});
const validate = validateFactory(Model);

export async function main() {
    const suite = new BenchSuite('deepkit');

    if (!validate(good)) throw new Error('Should be valid');

    suite.add('validate', () => {
        validate(good);
    });

    suite.run();
}
