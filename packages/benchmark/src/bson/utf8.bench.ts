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

import { Writer, ParserV2 } from '@deepkit/bson';
import 'reflect-metadata';
import { BenchSuite } from '../bench';

function parseUtf8(buffer: Uint8Array, size: number): string {
    const coded = new Uint16Array(size);
    return String.fromCharCode.apply(String, buffer as any);
}

const decoder = new TextDecoder("utf-8");
function parseUtf82(buffer: Uint8Array, size: number): string {
    return decoder.decode(buffer.slice(0, size));
}

export async function main() {
    const suite = new BenchSuite(`BSON utf8`);

    const size = 10 * 1024;
    const bigString = 'x'.repeat(size);

    const json = JSON.stringify(bigString);
    const writer = new Writer(new Uint8Array(size));
    writer.writeString(bigString);
    console.log('String size', size);

    suite.add('bson deserialize: big string', () => {
        const decoded = new ParserV2(writer.buffer).eatString(size);
    });

    suite.add('candidate 1 parse: big string', () => {
        const decoded = parseUtf8(writer.buffer, size);
    });

    suite.add('candidate 2 parse: big string', () => {
        const decoded = parseUtf82(writer.buffer, size);
    });

    suite.add('JSON.parse() big string', () => {
        const decoded = JSON.parse(json);
    });

    // suite.add('JSON.stringify big string', () => {
    //     const json = JSON.stringify(bigString);
    // });

    // suite.add('bson serialize: big string', () => {
    //     const writer = new Writer(new Uint8Array(size));
    //     writer.writeString(bigString);
    // });

    suite.run();
}
