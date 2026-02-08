/**
 * Tests for getBSONEncoder - high-level encoder with validation
 */
import { describe, test } from 'node:test';

import { expect } from '@deepkit/run/expect';
import { MinLength, Positive, typeOf } from '@deepkit/type';

import { getBSONEncoder, serializeBSONWithoutOptimiser } from '../index.js';

describe('getBSONEncoder basic usage', () => {
    test('string', () => {
        const encoder = getBSONEncoder(typeOf<string>());
        expect(encoder.decode(encoder.encode('abc'))).toEqual('abc');
    });

    test('number', () => {
        const encoder = getBSONEncoder(typeOf<number>());
        expect(encoder.decode(encoder.encode(123))).toEqual(123);
    });

    test('tuple', () => {
        type T = [number, string];
        const encoder = getBSONEncoder(typeOf<T>());
        expect(encoder.decode(encoder.encode([123, 'abc']))).toEqual([123, 'abc']);
    });

    test('object', () => {
        type T = { a: number; b: string };
        const encoder = getBSONEncoder(typeOf<T>());
        expect(encoder.decode(encoder.encode({ a: 123, b: 'abc' }))).toEqual({ a: 123, b: 'abc' });
    });

    test('union', () => {
        type T = string | number;
        const encoder = getBSONEncoder(typeOf<T>());
        expect(encoder.decode(encoder.encode('abc'))).toEqual('abc');
        expect(encoder.decode(encoder.encode(123))).toEqual(123);
    });
});

describe('encoder validation on encode', () => {
    test('MinLength constraint', () => {
        type T = string & MinLength<3>;
        const encoder = getBSONEncoder(typeOf<T>());
        expect(() => encoder.encode('ab')).toThrow('Min length is 3');
    });

    test('object with MinLength constraint', () => {
        type T = { v: string & MinLength<3> };
        const encoder = getBSONEncoder(typeOf<T>());
        expect(() => encoder.encode({ v: 'ab' })).toThrow('Min length is 3');
    });
});

describe('encoder validation on decode', () => {
    test('MinLength constraint', () => {
        type T = string & MinLength<3>;
        const encoder = getBSONEncoder(typeOf<T>());
        const bson = serializeBSONWithoutOptimiser({ v: 'b' });
        expect(() => encoder.decode(bson)).toThrow('Min length is 3');
    });

    test('object with MinLength constraint', () => {
        type T = { v: string & MinLength<3> };
        const encoder = getBSONEncoder(typeOf<T>());
        const bson = serializeBSONWithoutOptimiser({ v: 'b' });
        expect(() => encoder.decode(bson)).toThrow('Min length is 3');
    });
});

describe('union with constraints (#577)', () => {
    test('string & MinLength | null on encode', () => {
        type T = { code: (string & MinLength<1>) | null };
        const encoder = getBSONEncoder(typeOf<T>());

        // Valid cases
        expect(() => encoder.encode({ code: 'a' })).not.toThrow();
        expect(() => encoder.encode({ code: null })).not.toThrow();

        // Empty string fails MinLength - should show specific error
        expect(() => encoder.encode({ code: '' })).toThrow('Min length is 1');
    });

    test('multiple constrained types on encode', () => {
        type T = { value: (string & MinLength<1>) | (number & Positive) };
        const encoder = getBSONEncoder(typeOf<T>());

        // Valid cases
        expect(() => encoder.encode({ value: 'hello' })).not.toThrow();
        expect(() => encoder.encode({ value: 42 })).not.toThrow();

        // Empty string - should show minLength error
        expect(() => encoder.encode({ value: '' })).toThrow('Min length is 1');

        // Negative number - should show positive error
        expect(() => encoder.encode({ value: -5 })).toThrow('Number needs to be positive');
    });
});

describe('union with constraints on decode (#577)', () => {
    test('string & MinLength | null', () => {
        type T = (string & MinLength<1>) | null;
        const encoder = getBSONEncoder(typeOf<T>());

        // Valid cases
        expect(encoder.decode(encoder.encode('a'))).toEqual('a');
        expect(encoder.decode(encoder.encode(null))).toEqual(null);

        // Empty string fails MinLength - should show specific error
        expect(() => encoder.decode(encoder.encode(''))).toThrow('Min length is 1');
    });

    test('multiple constrained types', () => {
        type T = (string & MinLength<1>) | (number & Positive);
        const encoder = getBSONEncoder(typeOf<T>());

        // Valid cases
        expect(encoder.decode(encoder.encode('hello'))).toEqual('hello');
        expect(encoder.decode(encoder.encode(42))).toEqual(42);

        // Empty string - should show minLength error
        expect(() => encoder.decode(encoder.encode(''))).toThrow('Min length is 1');

        // Negative number - should show positive error
        expect(() => encoder.decode(encoder.encode(-5))).toThrow('Number needs to be positive');
    });
});

describe('nested union with deep constraint errors (#577)', () => {
    test('discriminated union with constraints', () => {
        interface ClickEvent {
            type: 'click';
            x: number & Positive;
            y: number & Positive;
        }

        interface ScrollEvent {
            type: 'scroll';
            offset: number;
        }

        interface InputEvent {
            type: 'input';
            value: string & MinLength<1>;
        }

        type T = ClickEvent | ScrollEvent | InputEvent;
        const encoder = getBSONEncoder(typeOf<T>());

        // Valid cases
        expect(encoder.decode(encoder.encode({ type: 'click', x: 10, y: 20 }))).toEqual({
            type: 'click',
            x: 10,
            y: 20,
        });
        expect(encoder.decode(encoder.encode({ type: 'scroll', offset: 100 }))).toEqual({
            type: 'scroll',
            offset: 100,
        });
        expect(encoder.decode(encoder.encode({ type: 'input', value: 'hello' }))).toEqual({
            type: 'input',
            value: 'hello',
        });

        // Deep constraint failure: x is negative in ClickEvent
        expect(() => encoder.decode(encoder.encode({ type: 'click', x: -5, y: 10 }))).toThrow('Number needs to be positive');

        // Deep constraint failure: value is empty in InputEvent
        expect(() => encoder.decode(encoder.encode({ type: 'input', value: '' }))).toThrow('Min length is 1');
    });
});

describe('structural errors in union', () => {
    test('missing required field shows field name', () => {
        interface ClickEvent {
            type: 'click';
            x: number;
            y: number;
        }

        interface ScrollEvent {
            type: 'scroll';
            offset: number;
        }

        type T = ClickEvent | ScrollEvent;
        const encoder = getBSONEncoder(typeOf<T>());

        // Valid cases
        expect(encoder.decode(encoder.encode({ type: 'click', x: 5, y: 10 }))).toEqual({
            type: 'click',
            x: 5,
            y: 10,
        });

        // Missing required field 'y' - error should include field name
        expect(() => encoder.decode(encoder.encode({ type: 'click', x: 5 } as any))).toThrow('ClickEvent.y');
        expect(() => encoder.decode(encoder.encode({ type: 'click', x: 5 } as any))).toThrow('Not a number');
    });
});
