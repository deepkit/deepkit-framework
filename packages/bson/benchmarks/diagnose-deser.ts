/**
 * Diagnostic: check BSON buffer integrity and deserialize performance.
 */
import { float64, int32 } from '@deepkit/type';

import { getBSONDeserializer, getBSONSerializer } from '../index.js';

interface DocInt32 {
    n: int32;
}

// Test 1: Does buffer reuse corrupt data?
const sInt32 = getBSONSerializer<DocInt32>();
const [buf1, size1] = sInt32({ n: 42 });
console.log('After serialize { n: 42 }:');
console.log('  buf1 bytes:', Array.from(buf1.slice(0, size1)));
console.log('  size:', size1);

const [buf2, size2] = sInt32({ n: 99 });
console.log('\nAfter serialize { n: 99 }:');
console.log('  buf2 bytes:', Array.from(buf2.slice(0, size2)));
console.log('  buf1 bytes:', Array.from(buf1.slice(0, size1)));
console.log('  buf1 === buf2?', buf1 === buf2);

// Test 2: Copy buffer before deserializing
const [origBuf] = sInt32({ n: 42 });
const copied = origBuf.slice(0, 12); // copy for safety
console.log('\nCopied buffer for { n: 42 }:', Array.from(copied));

const dInt32 = getBSONDeserializer<DocInt32>();
const result = dInt32(copied);
console.log('Deserialized:', result);

// Test 3: Deserialize immediately without any other serialize call
const sInt32b = getBSONSerializer<DocInt32>();
const [bufFresh] = sInt32b({ n: 42 });
const freshCopy = bufFresh.slice(0, 12);
console.log('\nFresh copy:', Array.from(freshCopy));
const dInt32b = getBSONDeserializer<DocInt32>();
console.log('Fresh deser:', dInt32b(freshCopy));

// Test 4: Simple timing with copied buffers
const safeBuf = new Uint8Array(freshCopy);
console.log('\n=== Timing with safe buffer ===');
const warmup = 100000;
for (let i = 0; i < warmup; i++) dInt32(safeBuf);

const N = 1000000;
const start = performance.now();
for (let i = 0; i < N; i++) dInt32(safeBuf);
const elapsed = performance.now() - start;
console.log(
    `${N} calls: ${elapsed.toFixed(2)} ms = ${((elapsed / N) * 1e6).toFixed(0)} ns/call = ${((N / elapsed) * 1000).toFixed(0)} ops/sec`,
);
