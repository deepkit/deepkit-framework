/**
 * Deepkit Framework - Public Benchmark
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * BSON: Deepkit vs js-bson
 *
 * This benchmark compares Deepkit's JIT-compiled BSON serializer/deserializer
 * against the official MongoDB js-bson library.
 */
import { BenchSuite } from '@deepkit/bench';
import { getBSONDeserializer, getBSONSerializer } from '@deepkit/bson';

// Try to import official bson package for comparison
let officialBson: typeof import('bson') | undefined;
try {
    officialBson = require('bson');
} catch {
    // Official bson package not available
}

// ============================================================================
// Test Schema
// ============================================================================

interface Item {
    id: number;
    name: string;
    ready: boolean;
    priority: number;
    tags: string[];
}

interface SingleItem {
    item: Item;
}

interface SmallBatch {
    cursor: {
        firstBatch: Item[];
    };
}

// ============================================================================
// Benchmark
// ============================================================================

export default async function () {
    if (!officialBson) {
        console.log('Skipping BSON benchmark: bson package not installed');
        return new BenchSuite('comparison/bson (skipped)');
    }

    const suite = new BenchSuite('comparison/bson');

    const singleItem: Item = { id: 1, name: 'Peter', ready: true, priority: 5, tags: ['a', 'b', 'c'] };

    // --- Single item ---
    const sSingle = getBSONSerializer<Item>();
    const dSingle = getBSONDeserializer<Item>();
    const [buf1, size1] = sSingle(singleItem);
    const singleBson = buf1.slice(0, size1);
    const singleBsonOfficial = officialBson.serialize(singleItem);

    suite.add('Deepkit serialize (1 item)', () => {
        sSingle(singleItem);
    });
    suite.add('js-bson serialize (1 item)', () => {
        officialBson!.serialize(singleItem);
    });
    suite.add('Deepkit deserialize (1 item)', () => {
        dSingle(singleBson);
    });
    suite.add('js-bson deserialize (1 item)', () => {
        officialBson!.deserialize(singleBsonOfficial);
    });

    // --- 10 items ---
    const items10: Item[] = [];
    for (let i = 0; i < 10; i++)
        items10.push({ id: i, name: 'Peter', ready: true, priority: 0, tags: ['a', 'b', 'c'] });
    const data10: SmallBatch = { cursor: { firstBatch: items10 } };
    const s10 = getBSONSerializer<SmallBatch>();
    const d10 = getBSONDeserializer<SmallBatch>();
    const [buf10, size10] = s10(data10);
    const bson10 = buf10.slice(0, size10);
    const bsonOfficial10 = officialBson.serialize(data10);

    suite.add('Deepkit serialize (10 items)', () => {
        s10(data10);
    });
    suite.add('js-bson serialize (10 items)', () => {
        officialBson!.serialize(data10);
    });
    suite.add('Deepkit deserialize (10 items)', () => {
        d10(bson10);
    });
    suite.add('js-bson deserialize (10 items)', () => {
        officialBson!.deserialize(bsonOfficial10);
    });

    // --- 1000 items ---
    const items1000: Item[] = [];
    for (let i = 0; i < 1000; i++)
        items1000.push({ id: i, name: 'Peter', ready: true, priority: 0, tags: ['a', 'b', 'c'] });
    const data1000: SmallBatch = { cursor: { firstBatch: items1000 } };
    const [buf1000, size1000] = s10(data1000);
    const bson1000 = buf1000.slice(0, size1000);
    const bsonOfficial1000 = officialBson.serialize(data1000);

    suite.add('Deepkit serialize (1000 items)', () => {
        s10(data1000);
    });
    suite.add('js-bson serialize (1000 items)', () => {
        officialBson!.serialize(data1000);
    });
    suite.add('Deepkit deserialize (1000 items)', () => {
        d10(bson1000);
    });
    suite.add('js-bson deserialize (1000 items)', () => {
        officialBson!.deserialize(bsonOfficial1000);
    });

    // --- 10000 items ---
    const items10k: Item[] = [];
    for (let i = 0; i < 10_000; i++)
        items10k.push({ id: i, name: 'Peter', ready: true, priority: 0, tags: ['a', 'b', 'c'] });
    const data10k: SmallBatch = { cursor: { firstBatch: items10k } };
    const [buf10k, size10k] = s10(data10k);
    const bson10k = buf10k.slice(0, size10k);
    const bsonOfficial10k = officialBson.serialize(data10k);

    suite.add('Deepkit serialize (10K items)', () => {
        s10(data10k);
    });
    suite.add('js-bson serialize (10K items)', () => {
        officialBson!.serialize(data10k);
    });
    suite.add('Deepkit deserialize (10K items)', () => {
        d10(bson10k);
    });
    suite.add('js-bson deserialize (10K items)', () => {
        officialBson!.deserialize(bsonOfficial10k);
    });

    return suite;
}
