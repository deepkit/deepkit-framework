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

import { BenchSuite } from '../bench';

export async function main() {
    const suite = new BenchSuite(`Object hydration`);

    const props = ['property', 'peter', 'mowla'];

    suite.add('{}', () => {
        const obj: any = {};
        for (const name of props) obj[name] = 1;
    });

    // const obj2: any = new ZZ();
    // obj2.property = 1;
    //
    // suite.add('class', () => {
    //     obj2.property = 1;
    // });

    // const Entity1 = function () {}
    // suite.add('new Entity1', () => {
    //     const obj: any = new Entity1();
    //     for (const name of props) obj[name] = 1;
    // });

    const proto: any = {};
    for (const name of props) proto[name] = 1;

    const Entity2 = function () {
    };
    Entity2.prototype = proto;

    suite.add('with prototype', () => {
        const obj: any = new Entity2();
        for (let i = 0; i < 3; i++) {
            obj[props[i]] = 1;
        }
    });

    function pre(obj: any) {
        obj.property = 1;
        obj.peter = 1;
        obj.mowla = 1;
    }

    suite.add('with prototype pre', () => {
        const obj: any = new Entity2();
        pre(obj);
    });

    suite.run();
}
