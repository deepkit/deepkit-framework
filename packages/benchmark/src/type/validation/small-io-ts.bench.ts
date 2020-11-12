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

import * as t from 'io-ts';
import * as G from 'io-ts/lib/Guard';
import {isRight} from 'fp-ts/Either';
import {good} from './validation';
import {BenchSuite} from '../../bench';

const decoderIoTS = t.type({
    number: t.number,
    negNumber: t.number,
    maxNumber: t.number,
    string: t.string,
    longString: t.string,
    boolean: t.boolean,
    deeplyNested: t.type({
        foo: t.string,
        num: t.number,
        bool: t.boolean
    })
})

const guardIoTS = G.type({
    number: G.number,
    negNumber: G.number,
    maxNumber: G.number,
    string: G.string,
    longString: G.string,
    boolean: G.boolean,
    deeplyNested: G.type({
        foo: G.string,
        num: G.number,
        bool: G.boolean
    })
})

export async function main() {
    const suite = new BenchSuite('io-ts');

    suite.add('validate', () => {
        isRight(decoderIoTS.decode(good));
    });

    suite.add('validate-no-errors', () => {
        guardIoTS.is(good);
    });

    suite.run();
}
