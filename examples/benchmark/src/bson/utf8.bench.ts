/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { buildStringDecoder, decodeUTF8, decodeUTF8Short, Writer } from '@deepkit/bson';
import { BenchSuite } from '../bench.js';
import { performance } from 'perf_hooks';
import { GetOptimizationStatus } from '../utils.js';

function parseUtf8(buffer: Uint8Array, size: number): string {
    const coded = new Uint16Array(size);
    return String.fromCharCode.apply(String, buffer as any);
}

const decoder = new TextDecoder('utf-8');

function parseUtf82(buffer: Uint8Array, size: number): string {
    return decoder.decode(buffer.slice(0, size));
}

export async function main() {

    const header: string[] = ['size', 'JSON.parse'];
    const rows: string[] = [];

    const encoder = new TextEncoder();
    const decoder = new TextDecoder('utf-8');

    const spec5 = buildStringDecoder(5);
    const spec10 = buildStringDecoder(10);
    const spec20 = buildStringDecoder(20);
    const spec30 = buildStringDecoder(30);
    const spec64 = buildStringDecoder(64);
    const spec128 = buildStringDecoder(128);
    // const spec1000 = buildStringDecoder(1000);
    const implementations: { name: string, do: (v: Uint8Array, size: number) => string }[] = [
        { name: 'String.fromCharCode.apply', do: (v: Uint8Array, size: number) => parseUtf8(v, size) },
        { name: 'decodeUTF8', do: (v: Uint8Array, size: number) => decodeUTF8(v, 0, size) },
        { name: 'specialized 5', do: (v: Uint8Array, size: number) => spec5(v, 0, size) },
        { name: 'specialized 10', do: (v: Uint8Array, size: number) => spec10(v, 0, size) },
        { name: 'specialized 64', do: (v: Uint8Array, size: number) => spec64(v, 0, size) },
        { name: 'specialized 128', do: (v: Uint8Array, size: number) => spec128(v, 0, size) },
        // {name: 'specialized 1000', do: (v: Uint8Array, size: number) => spec1000(v, 0, size)},
        { name: 'TextDecoder.decode', do: (v: Uint8Array, size: number) => decoder.decode(v.slice(0, size)) },
    ];

    for (const impl of implementations) {
        header.push(impl.name);
    }

    //warmup
    for (let i = 0; i < 1000; i++) {
        const size = 1500;
        const string = 'x'.repeat(size);
        const uint8array = encoder.encode(string);
        const json = JSON.stringify(string);

        JSON.parse(json);
        for (const impl of implementations) impl.do(uint8array, size);
    }

    console.log('optimization spec64', GetOptimizationStatus(spec64));

    for (let i = 0; i < 50; i++) {
        const size = (i * 6);
        const string = 'x'.repeat(size);
        const uint8array = encoder.encode(string);
        const json = JSON.stringify(string);

        const row: number[] = [size];

        const count = 500;
        let jsonTime = 0;
        for (let i = 0; i < count; i++) {
            const start = performance.now();
            JSON.parse(json);
            jsonTime += performance.now() - start;
        }
        row.push(jsonTime / count);

        for (const impl of implementations) {
            let time = 0;
            for (let i = 0; i < count; i++) {
                const start = performance.now();
                impl.do(uint8array, size);
                time += performance.now() - start;
            }
            row.push(time / count);
        }

        rows.push(row.join('; ').replace(/\./g, ','));
    }

    console.log(header.join(';'));
    for (const row of rows) console.log(row);

    const suite = new BenchSuite(`BSON utf8`);

    const bigString = 'Peter'.repeat(64);
    const size = bigString.length; //I know thats not the real bytes

    const json = JSON.stringify(bigString);
    const writer = new Writer(new Uint8Array(size));
    writer.writeString(bigString);
    console.log('String size', size);

    suite.add('decodeUTF8', () => {
        decodeUTF8(writer.buffer, 0, size);
    });

    suite.add('decodeUTF8Short', () => {
        decodeUTF8Short(writer.buffer, 0, size);
    });

    spec10(writer.buffer, 0, size);

    suite.add('specialized 10', () => {
        spec10(writer.buffer, 0, size);
    });

    suite.add('specialized 20', () => {
        spec20(writer.buffer, 0, size);
    });

    suite.add('specialized 128', () => {
        spec128(writer.buffer, 0, size);
    });

    const specExact = buildStringDecoder(size);
    specExact(writer.buffer, 0, size);
    suite.add('specialized exact' + size, () => {
        specExact(writer.buffer, 0, size);
    });

    suite.add('String.fromCharCode.apply', () => {
        const decoded = parseUtf8(writer.buffer, size);
    });

    suite.add('String.fromCharCode specialized', () => {
        const codes = writer.buffer;
        let s = String.fromCharCode(
            codes[0], codes[1], codes[2], codes[3], codes[4], codes[5], codes[6], codes[7], codes[8], codes[9],
            codes[10], codes[11], codes[12], codes[13], codes[14], codes[15], codes[16], codes[17], codes[18], codes[19],
            codes[20], codes[21], codes[22], codes[23], codes[24], codes[25], codes[26], codes[27], codes[28], codes[29],
            codes[20], codes[21], codes[22], codes[23], codes[24], codes[25], codes[26], codes[27], codes[28], codes[29],
            codes[20], codes[21], codes[22], codes[23], codes[24], codes[25], codes[26], codes[27], codes[28], codes[29],
            codes[20], codes[21], codes[22], codes[23], codes[24], codes[25], codes[26], codes[27], codes[28], codes[29],
            codes[20], codes[21], codes[22], codes[23], codes[24], codes[25], codes[26], codes[27], codes[28], codes[29],
            codes[20], codes[21], codes[22], codes[23], codes[24], codes[25], codes[26], codes[27], codes[28], codes[29],
            codes[20], codes[21], codes[22], codes[23], codes[24], codes[25], codes[26], codes[27], codes[28], codes[29],
            codes[20], codes[21], codes[22], codes[23], codes[24], codes[25], codes[26], codes[27], codes[28], codes[29],

            codes[20], codes[21], codes[22], codes[23], codes[24], codes[25], codes[26], codes[27], codes[28], codes[29],
            codes[20], codes[21], codes[22], codes[23], codes[24], codes[25], codes[26], codes[27], codes[28], codes[29],
            codes[20], codes[21], codes[22], codes[23], codes[24], codes[25], codes[26], codes[27], codes[28], codes[29],
            codes[20], codes[21], codes[22], codes[23], codes[24], codes[25], codes[26], codes[27], codes[28], codes[29],
            codes[20], codes[21], codes[22], codes[23], codes[24], codes[25], codes[26], codes[27], codes[28], codes[29],
            codes[20], codes[21], codes[22], codes[23], codes[24], codes[25], codes[26], codes[27], codes[28], codes[29],
            codes[20], codes[21], codes[22], codes[23], codes[24], codes[25], codes[26], codes[27], codes[28], codes[29],
            codes[20], codes[21], codes[22], codes[23], codes[24], codes[25], codes[26], codes[27], codes[28], codes[29],
            codes[20], codes[21], codes[22], codes[23], codes[24], codes[25], codes[26], codes[27], codes[28], codes[29],
            codes[20], codes[21], codes[22], codes[23], codes[24], codes[25], codes[26], codes[27], codes[28], codes[29],

            codes[20], codes[21], codes[22], codes[23], codes[24], codes[25], codes[26], codes[27], codes[28], codes[29],
            codes[20], codes[21], codes[22], codes[23], codes[24], codes[25], codes[26], codes[27], codes[28], codes[29],
            codes[20], codes[21], codes[22], codes[23], codes[24], codes[25], codes[26], codes[27], codes[28], codes[29],
            codes[20], codes[21], codes[22], codes[23], codes[24], codes[25], codes[26], codes[27], codes[28], codes[29],
            codes[20], codes[21], codes[22], codes[23], codes[24], codes[25], codes[26], codes[27], codes[28], codes[29],
            codes[20], codes[21], codes[22], codes[23], codes[24], codes[25], codes[26], codes[27], codes[28], codes[29],
            codes[20], codes[21], codes[22], codes[23], codes[24], codes[25], codes[26], codes[27], codes[28], codes[29],
            codes[20], codes[21], codes[22], codes[23], codes[24], codes[25], codes[26], codes[27], codes[28], codes[29],
            codes[20], codes[21], codes[22], codes[23], codes[24], codes[25], codes[26], codes[27], codes[28], codes[29],
            codes[20], codes[21], codes[22], codes[23], codes[24], codes[25], codes[26], codes[27], codes[28], codes[29],
        );
    });

    suite.add('TextDecoder', () => {
        const decoded = parseUtf82(writer.buffer, size);
    });

    suite.add('JSON.parse()', () => {
        const decoded = JSON.parse(json);
    });

    suite.add('fromCharCode hardcoded', () => {
        const s = String.fromCharCode(102, 117, 110, 99, 116, 105, 111, 110, 32, 115, 102, 117, 110, 99, 116, 105, 111, 110, 32, 115, 102, 117, 110, 99, 116, 105, 111, 110, 32, 115);
    });

    const codes2 = new Uint8Array([102, 117, 110, 99, 116, 105, 111, 110, 32, 115, 102, 117, 110, 99, 116, 105, 111, 110, 32, 115, 102, 117, 110, 99, 116, 105, 111, 110, 32, 115]);
    suite.add('specialist 30', () => {
        const s = spec30(codes2, 0, 30);
    });

    suite.add('fromCodePoint hardcoded', () => {
        const s = String.fromCodePoint(102, 117, 110, 99, 116, 105, 111, 110, 32, 115, 102, 117, 110, 99, 116, 105, 111, 110, 32, 115, 102, 117, 110, 99, 116, 105, 111, 110, 32, 115);
    });

    const codes = [102, 117, 110, 99, 116, 105, 111, 110, 32, 115, 102, 117, 110, 99, 116, 105, 111, 110, 32, 115, 102, 117, 110, 99, 116, 105, 111, 110, 32, 115];
    suite.add('fromCharCode apply', () => {
        const s = String.fromCharCode.apply(String, codes);
    });

    suite.add('fromCharCode apply uint8', () => {
        const s = String.fromCharCode.apply(String, codes2 as any);
    });

    suite.add('fromCharCode apply uint8 specialized', () => {
        let s = String.fromCharCode(codes2[0], codes2[1], codes2[2], codes2[3], codes2[4], codes2[5], codes2[6], codes2[7], codes2[8], codes2[9],);
        s += String.fromCharCode(codes2[10], codes2[11], codes2[12], codes2[13], codes2[14], codes2[15], codes2[16], codes2[17], codes2[18], codes2[19],);
        s += String.fromCharCode(codes2[20], codes2[21], codes2[22], codes2[23], codes2[24], codes2[25], codes2[26], codes2[27], codes2[28], codes2[29],);
    });

    suite.add('fromCharCode apply uint8 specialized full', () => {
        let s = String.fromCharCode(
            codes2[0], codes2[1], codes2[2], codes2[3], codes2[4], codes2[5], codes2[6], codes2[7], codes2[8], codes2[9],
            codes2[10], codes2[11], codes2[12], codes2[13], codes2[14], codes2[15], codes2[16], codes2[17], codes2[18], codes2[19],
            codes2[20], codes2[21], codes2[22], codes2[23], codes2[24], codes2[25], codes2[26], codes2[27], codes2[28], codes2[29],
        );
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
