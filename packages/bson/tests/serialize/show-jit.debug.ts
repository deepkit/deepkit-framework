import { test } from 'node:test';

import { setJitDebug } from '@deepkit/core';
import { expect } from '@deepkit/run/expect';
import { int32 } from '@deepkit/type';

import { getBSONSerializer } from '../../index.js';

test('show jit code for int32 x3', () => {
    interface Doc {
        a: int32;
        b: int32;
        c: int32;
    }
    setJitDebug(true);
    const serializer = getBSONSerializer<Doc>();
    setJitDebug(false);
    const [buffer, size] = serializer({ a: 1, b: 2, c: 3 });
    console.log(
        'Result bytes:',
        Array.from(buffer.subarray(0, size))
            .map(b => b.toString(16).padStart(2, '0'))
            .join(' '),
    );
});

test('show jit code for plain number', () => {
    interface Doc {
        n: number;
    }
    setJitDebug(true);
    const serializer = getBSONSerializer<Doc>();
    setJitDebug(false);
    const [buffer, size] = serializer({ n: 42 });
    console.log('Result:', Array.from(buffer.subarray(0, size)));
});

test('show jit code for string', () => {
    setJitDebug(true);
    const serializer = getBSONSerializer<{ name: string }>();
    setJitDebug(false);
    const [buffer, size] = serializer({ name: 'Peter' });
    console.log(
        'Result bytes:',
        Array.from(buffer.subarray(0, size))
            .map(b => b.toString(16).padStart(2, '0'))
            .join(' '),
    );
});

test('show jit code for mixed primitives', () => {
    setJitDebug(true);
    const serializer = getBSONSerializer<{
        name: string;
        age: number;
        active: boolean;
    }>();
    setJitDebug(false);
    const [buffer, size] = serializer({ name: 'Alice', age: 30, active: true });
    console.log(
        'Result bytes:',
        Array.from(buffer.subarray(0, size))
            .map(b => b.toString(16).padStart(2, '0'))
            .join(' '),
    );
});

test('show jit code for Uint8Array', () => {
    setJitDebug(true);
    const serializer = getBSONSerializer<{ b: Uint8Array }>();
    setJitDebug(false);
    const [buffer, size] = serializer({ b: new Uint8Array([1, 2, 3]) });
    console.log('Result:', Array.from(buffer.subarray(0, size)));
});

test('show jit code for 3 strings', () => {
    interface Meta {
        requestId: string;
        version: string;
        region: string;
    }
    setJitDebug(true);
    const serializer = getBSONSerializer<Meta>();
    setJitDebug(false);
    const data: Meta = {
        requestId: 'req-abc123',
        version: '2.1.0',
        region: 'us-east-1',
    };
    const [buffer, size] = serializer(data);
    console.log('Result size:', size);
});
