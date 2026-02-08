/**
 * Deepkit Framework - Debug Benchmark
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * BSON Internal Benchmarks
 *
 * These benchmarks help profile internal BSON operations for optimization.
 * Not intended for public comparison.
 */
import { BenchSuite } from '@deepkit/bench';
import { BaseParser, decodeUTF8, getBSONDeserializer, getBSONSerializer, parseObject } from '@deepkit/bson';

// Try to import official bson package
let officialBson: typeof import('bson') | undefined;
try {
    officialBson = require('bson');
} catch {
    // Not available
}

function randomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

export default async function () {
    const suite = new BenchSuite('debug/bson-internals');

    interface Item {
        id: number;
        name: string;
        ready: boolean;
        priority: number;
        tags: string[];
    }

    const item: Item = {
        id: 1,
        name: 'Peter',
        ready: true,
        priority: 0,
        tags: ['a', 'b', 'c'],
    };

    // ========================================================================
    // JIT vs Generic Parser
    // ========================================================================

    const serializer = getBSONSerializer<Item>();
    const bsonData = serializer(item);

    const jitParser = getBSONDeserializer<Item>();
    jitParser(bsonData); // warmup

    suite.add('JIT deserializer', () => {
        jitParser(bsonData);
    });

    suite.add('Generic BaseParser', () => {
        parseObject(new BaseParser(bsonData));
    });

    // ========================================================================
    // UTF-8 Decoding at Various Sizes
    // ========================================================================

    for (const size of [8, 32, 128, 512]) {
        const stringBinary = Buffer.from(randomString(size));
        suite.add(`decodeUTF8 ${size}B`, () => {
            decodeUTF8(stringBinary, 0, stringBinary.byteLength);
        });
    }

    // ========================================================================
    // ObjectId Hex Conversion (if bson available)
    // ========================================================================

    if (officialBson) {
        const { ObjectId } = officialBson;
        const objectId = new ObjectId();
        const b = objectId.id;

        const hexTable: string[] = [];
        for (let i = 0; i < 256; i++) {
            hexTable[i] = (i <= 15 ? '0' : '') + i.toString(16);
        }

        suite.add('ObjectId.toString()', () => {
            objectId.toString();
        });

        suite.add('Lookup table hex', () => {
            hexTable[b[0]] +
                hexTable[b[1]] +
                hexTable[b[2]] +
                hexTable[b[3]] +
                hexTable[b[4]] +
                hexTable[b[5]] +
                hexTable[b[6]] +
                hexTable[b[7]] +
                hexTable[b[8]] +
                hexTable[b[9]] +
                hexTable[b[10]] +
                hexTable[b[11]];
        });
    }

    return suite;
}
