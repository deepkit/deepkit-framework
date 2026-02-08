import * as bson from 'bson';
import { test } from 'node:test';

import { expect } from '@deepkit/run/expect';

import { getBSONSerializer } from '../../index.js';

test('UTF-8 string encoding', () => {
    const serialize = getBSONSerializer<{ name: string }>();

    // Test cases with various UTF-8 characters
    const testCases = [
        { name: 'Peter' }, // ASCII only
        { name: '' }, // Empty
        { name: 'Héllo' }, // 2-byte UTF-8 (é = C3 A9)
        { name: '世界' }, // 3-byte UTF-8 (Chinese)
        { name: 'Hello 世界!' }, // Mixed ASCII + 3-byte
        { name: '🌍' }, // 4-byte UTF-8 (emoji, surrogate pair)
        { name: 'Hi 🌍!' }, // Mixed with emoji
        { name: 'Ω≈ç√∫' }, // Various symbols
    ];

    for (const data of testCases) {
        const [buffer, size] = serialize(data);
        const ours = buffer.slice(0, size); // copy for comparison
        const theirs = bson.serialize(data);

        expect(Array.from(ours)).toEqual(Array.from(theirs));
    }
});
