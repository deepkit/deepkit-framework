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

import { good } from './validation';
//we use `e` and not `v` because deepkit/type supports out of the box error explanations, which quartet does only with `e`.
import { e } from 'quartet';
import { BenchSuite } from '../../bench';

const QuartetModelChecker = e<any>({
    number: e.number,
    negNumber: e.and(e.number, e.negative),
    maxNumber: e.number,
    strings: e.arrayOf(e.string),
    longString: e.and(e.string, e.minLength(100)),
    boolean: e.boolean,
});

export async function main() {
    const suite = new BenchSuite('quartet');

    suite.add('validate', () => {
        QuartetModelChecker(good);
    });

    suite.run();
}
