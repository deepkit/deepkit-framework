/**
 * Debug benchmark to understand why performance is so low
 */
import { int32 } from '@deepkit/type';

import { getBSONDeserializer, getBSONSerializer } from '../index.js';

interface Doc {
    n: int32;
}

const serialize = getBSONSerializer<Doc>();
const [bson] = serialize({ n: 42 });

console.log(
    'BSON buffer:',
    Array.from(bson)
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' '),
);

const deserialize = getBSONDeserializer<Doc>();

// First call - should learn shape
console.log('\nFirst call (learning):');
const r1 = deserialize(bson);
console.log('Result:', r1);

// Second call - should use fast path
console.log('\nSecond call (should be fast):');
const r2 = deserialize(bson);
console.log('Result:', r2);

// Manual benchmark
console.log('\nManual timing (10M iterations):');
const start = performance.now();
for (let i = 0; i < 10_000_000; i++) {
    deserialize(bson);
}
const elapsed = performance.now() - start;
console.log(`Time: ${elapsed.toFixed(0)}ms`);
console.log(`Ops/sec: ${(10_000_000 / (elapsed / 1000) / 1_000_000).toFixed(1)}M`);
