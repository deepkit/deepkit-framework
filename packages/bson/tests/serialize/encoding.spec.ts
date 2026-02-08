/**
 * Serialization tests for string encoding: UTF-8, surrogate pairs, special characters
 */
import * as bson from 'bson';
import { test } from 'node:test';

import { expect } from '@deepkit/run/expect';

import { SerializeResult, getBSONSerializer } from '../../index.js';

const { deserialize, serialize } = bson;

// Helper to extract buffer from tuple result
function toBuffer(result: SerializeResult): Uint8Array {
    const [buffer, size] = result;
    return buffer.slice(0, size);
}

test('utf16 surrogate pair', () => {
    const comment = "Hehe, yes. Baby's first collar \uD83E\uDD2D";

    // Typed serializer with bson.deserialize for verification
    const serializer = getBSONSerializer<{ comment: string }>();
    const bsonData = toBuffer(serializer({ comment }));
    const back = deserialize(Buffer.from(bsonData));
    expect(back.comment).toBe(comment);

    // Verify matches official bson output
    expect(Buffer.from(bsonData)).toEqual(serialize({ comment }));
});

test('utf8 japanese', () => {
    const messages = {
        '— feel free to": "— それまでご自由に': '— feel free to": "— それまでご自由に',
        'Schoolismの1年間のサブスクリプションを勝つチャンスを得るために、ツアーを必ず完全に終了してください！': 'Schoolismの1年間のサブスクリプションを勝つチャンスを得るために、ツアーを必ず完全に終了してください！',
    };

    for (const [_, msg] of Object.entries(messages)) {
        // Official BSON
        {
            const bsonData = serialize({ msg });
            const back = deserialize(bsonData);
            expect(back.msg).toBe(msg);
        }

        // Typed serializer round-trip via bson.deserialize
        {
            const bsonData = toBuffer(getBSONSerializer<{ msg: string }>()({ msg }));
            const back = deserialize(Buffer.from(bsonData));
            expect(back.msg).toBe(msg);
        }
    }
});

test('emoji string', () => {
    const serializer = getBSONSerializer<{ v: string }>();

    const emojis = ['🌉', '✌️', '🤣', '👨‍👩‍👧‍👦', '🏳️‍🌈'];

    for (const emoji of emojis) {
        const bsonData = toBuffer(serializer({ v: emoji }));
        const back = deserialize(Buffer.from(bsonData));
        expect(back.v).toBe(emoji);
    }
});

test('special unicode characters', () => {
    const serializer = getBSONSerializer<{ v: string }>();

    const chars = ['Ѓ', '㒨', '﨣', 'πøˆ️', '中文', 'العربية', 'עברית'];

    for (const char of chars) {
        const bsonData = toBuffer(serializer({ v: char }));
        const back = deserialize(Buffer.from(bsonData));
        expect(back.v).toBe(char);
    }
});

test('null byte in string', () => {
    const serializer = getBSONSerializer<{ v: string }>();

    const str = 'hello\x00world';
    const bsonData = toBuffer(serializer({ v: str }));
    const back = deserialize(Buffer.from(bsonData));
    expect(back.v).toBe(str);
});

test('very long string', () => {
    const serializer = getBSONSerializer<{ v: string }>();

    const longStr = 'a'.repeat(100000);
    const bsonData = toBuffer(serializer({ v: longStr }));
    const back = deserialize(Buffer.from(bsonData));
    expect(back.v).toBe(longStr);
});
