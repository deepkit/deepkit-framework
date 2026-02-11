/**
 * Lightweight expect() shim over node:assert for migrating Jest tests to node:test.
 *
 * Covers all matchers used across deepkit tests:
 *   toBe, toEqual, toContain, toMatchObject, toMatch,
 *   toThrow/toThrowError, toBeInstanceOf, toBeCloseTo,
 *   toBeDefined, toBeUndefined,
 *   toBeGreaterThan, toBeGreaterThanOrEqual,
 *   toBeLessThan, toBeLessThanOrEqual,
 *   toHaveBeenCalledTimes,
 *   not.*
 *
 * Also exports fn() as a lightweight jest.fn() replacement.
 *
 * toEqual uses structural comparison (like Jest) — ignores constructors,
 * compares Dates by getTime(), Maps/Sets by entries, etc.
 */
import { strict as assert } from 'node:assert';

// Fix BigInt serialization issue (was in jest-setup.ts)
if (typeof BigInt === 'function' && !(BigInt.prototype as any).toJSON) {
    (BigInt.prototype as any).toJSON = function () {
        return this.toString();
    };
}

/**
 * Asymmetric matcher symbol — used by expect.any(), expect.anything(), etc.
 */
const ASYMMETRIC = Symbol('asymmetric');

interface AsymmetricMatcher {
    [ASYMMETRIC]: true;
    check(actual: unknown): boolean;
    toString(): string;
}

function isAsymmetricMatcher(v: unknown): v is AsymmetricMatcher {
    return v !== null && typeof v === 'object' && ASYMMETRIC in (v as any);
}

/**
 * Jest-compatible structural deep equality.
 * Ignores constructor identity (PilotId{value:34} == {value:34}).
 * Compares Dates by getTime(), Maps/Sets by entries, RegExps by toString().
 */
function jestDeepEqual(a: unknown, b: unknown, seen = new Set<object>()): boolean {
    // Asymmetric matchers
    if (isAsymmetricMatcher(b)) return b.check(a);
    if (isAsymmetricMatcher(a)) return a.check(b);

    // Identical values (handles NaN via Object.is)
    if (Object.is(a, b)) return true;

    // Both must be non-null objects
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;

    // Circular reference guard
    if (seen.has(a as object)) return true;
    seen.add(a as object);

    // Date
    if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();

    // RegExp
    if (a instanceof RegExp && b instanceof RegExp) return a.toString() === b.toString();

    // TypedArray / Buffer
    if (ArrayBuffer.isView(a) && ArrayBuffer.isView(b)) {
        const av = new Uint8Array((a as Uint8Array).buffer, (a as Uint8Array).byteOffset, (a as Uint8Array).byteLength);
        const bv = new Uint8Array((b as Uint8Array).buffer, (b as Uint8Array).byteOffset, (b as Uint8Array).byteLength);
        if (av.length !== bv.length) return false;
        for (let i = 0; i < av.length; i++) if (av[i] !== bv[i]) return false;
        return true;
    }

    // Map
    if (a instanceof Map && b instanceof Map) {
        if (a.size !== b.size) return false;
        for (const [key, val] of a) {
            let found = false;
            for (const [bKey, bVal] of b) {
                if (jestDeepEqual(key, bKey, seen) && jestDeepEqual(val, bVal, seen)) {
                    found = true;
                    break;
                }
            }
            if (!found) return false;
        }
        return true;
    }

    // Set
    if (a instanceof Set && b instanceof Set) {
        if (a.size !== b.size) return false;
        for (const val of a) {
            let found = false;
            for (const bVal of b) {
                if (jestDeepEqual(val, bVal, seen)) {
                    found = true;
                    break;
                }
            }
            if (!found) return false;
        }
        return true;
    }

    // Array
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (!jestDeepEqual(a[i], b[i], seen)) return false;
        }
        return true;
    }

    // One is array, other is not
    if (Array.isArray(a) !== Array.isArray(b)) return false;

    // Plain objects / class instances — compare own enumerable keys
    // Jest ignores undefined-valued properties: {v: undefined} equals {}
    const aKeys = Object.keys(a).filter(k => (a as any)[k] !== undefined);
    const bKeys = Object.keys(b).filter(k => (b as any)[k] !== undefined);
    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
        if ((b as any)[key] === undefined) return false;
        if (!jestDeepEqual((a as any)[key], (b as any)[key], seen)) return false;
    }
    return true;
}

/**
 * Jest-compatible partial object match.
 * Every key in `expected` must exist and match in `actual`, but `actual` may have extra keys.
 */
function jestMatchObject(actual: unknown, expected: unknown, seen = new Set<object>()): boolean {
    if (Object.is(actual, expected)) return true;
    if (actual === null || expected === null || typeof actual !== 'object' || typeof expected !== 'object') {
        return jestDeepEqual(actual, expected, seen);
    }

    if (seen.has(actual as object)) return true;
    seen.add(actual as object);

    if (Array.isArray(expected)) {
        if (!Array.isArray(actual)) return false;
        for (let i = 0; i < expected.length; i++) {
            if (!jestMatchObject(actual[i], expected[i], seen)) return false;
        }
        return true;
    }

    for (const key of Object.keys(expected)) {
        if (!jestMatchObject((actual as any)[key], (expected as any)[key], seen)) return false;
    }
    return true;
}

function formatValue(v: unknown): string {
    try {
        return JSON.stringify(v, (_k, val) => (typeof val === 'bigint' ? val.toString() + 'n' : val), 2) ?? String(v);
    } catch {
        return String(v);
    }
}

/**
 * Extend jestDeepEqual to support asymmetric matchers in expected values.
 */
function matchesWithAsymmetric(actual: unknown, expected: unknown): boolean {
    if (isAsymmetricMatcher(expected)) return expected.check(actual);
    return jestDeepEqual(actual, expected);
}

interface Matchers {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toContain(expected: unknown): void;
    toMatchObject(expected: object): void;
    toMatch(expected: string | RegExp): void;
    toThrow(expected?: string | RegExp | Error): void;
    toThrowError(expected?: string | RegExp | Error): void;
    toBeInstanceOf(expected: Function): void;
    toBeCloseTo(expected: number, numDigits?: number): void;
    toBeDefined(): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toBeNull(): void;
    toHaveLength(expected: number): void;
    toHaveProperty(path: string, value?: unknown): void;
    toBeUndefined(): void;
    toBeGreaterThan(expected: number): void;
    toBeGreaterThanOrEqual(expected: number): void;
    toBeLessThan(expected: number): void;
    toBeLessThanOrEqual(expected: number): void;
    toHaveBeenCalledTimes(expected: number): void;
    toHaveBeenCalled(): void;
    toHaveBeenCalledWith(...args: unknown[]): void;
}

interface ExpectStatic {
    (actual: unknown): Expect;
    any(constructor: Function): AsymmetricMatcher;
    anything(): AsymmetricMatcher;
    arrayContaining(expected: unknown[]): AsymmetricMatcher;
    objectContaining(expected: object): AsymmetricMatcher;
    stringContaining(expected: string): AsymmetricMatcher;
}

interface AsyncMatchers {
    toBe(expected: unknown): Promise<void>;
    toEqual(expected: unknown): Promise<void>;
    toContain(expected: unknown): Promise<void>;
    toMatchObject(expected: object): Promise<void>;
    toMatch(expected: string | RegExp): Promise<void>;
    toThrow(expected?: string | RegExp | Function): Promise<void>;
    toThrowError(expected?: string | RegExp | Function): Promise<void>;
    toBeInstanceOf(expected: Function): Promise<void>;
    toBeDefined(): Promise<void>;
    toBeUndefined(): Promise<void>;
    toBeTruthy(): Promise<void>;
    toBeFalsy(): Promise<void>;
}

interface Expect extends Matchers {
    not: Matchers;
    rejects: AsyncMatchers;
    resolves: AsyncMatchers;
}

function expectImpl(actual: unknown): Expect {
    const matchers: Matchers = {
        toBe(expected: unknown) {
            assert.strictEqual(actual, expected);
        },
        toEqual(expected: unknown) {
            if (!jestDeepEqual(actual, expected)) {
                assert.fail(
                    `Expected values to be structurally equal:\nActual:   ${formatValue(actual)}\nExpected: ${formatValue(expected)}`,
                );
            }
        },
        toContain(expected: unknown) {
            if (typeof actual === 'string') {
                assert.ok(actual.includes(expected as string), `Expected string to contain "${expected}":\n${actual}`);
            } else if (Array.isArray(actual)) {
                const found = actual.some(item => Object.is(item, expected) || jestDeepEqual(item, expected));
                assert.ok(found, `Expected array to contain ${formatValue(expected)}:\n${formatValue(actual)}`);
            } else {
                assert.fail(`toContain called on non-string, non-array: ${typeof actual}`);
            }
        },
        toMatchObject(expected: object) {
            if (!jestMatchObject(actual, expected)) {
                assert.fail(
                    `Expected object to match:\nActual:   ${formatValue(actual)}\nExpected: ${formatValue(expected)}`,
                );
            }
        },
        toMatch(expected: string | RegExp) {
            const str = actual as string;
            if (typeof expected === 'string') {
                assert.ok(str.includes(expected), `Expected "${str}" to match "${expected}"`);
            } else {
                assert.match(str, expected);
            }
        },
        toThrow(expected?: string | RegExp | Error) {
            if (typeof expected === 'string') {
                // Jest's toThrow('str') checks message.includes(str)
                assert.throws(actual as () => void, (err: any) => {
                    if (!err.message?.includes(expected)) {
                        assert.fail(`Expected error message to contain "${expected}", got "${err.message}"`);
                    }
                    return true;
                });
            } else if (expected instanceof RegExp) {
                assert.throws(actual as () => void, expected);
            } else {
                assert.throws(actual as () => void);
            }
        },
        toThrowError(expected?: string | RegExp | Error) {
            // Jest alias
            matchers.toThrow(expected);
        },
        toBeInstanceOf(expected: Function) {
            assert.ok(actual instanceof expected, `Expected instance of ${expected.name}, got ${actual}`);
        },
        toBeCloseTo(expected: number, numDigits = 2) {
            const precision = Math.pow(10, -numDigits) / 2;
            assert.ok(
                Math.abs((actual as number) - expected) < precision,
                `Expected ${actual} to be close to ${expected} (precision ${numDigits})`,
            );
        },
        toBeDefined() {
            assert.notStrictEqual(actual, undefined);
        },
        toBeUndefined() {
            assert.strictEqual(actual, undefined);
        },
        toBeGreaterThan(expected: number) {
            assert.ok((actual as number) > expected, `Expected ${actual} > ${expected}`);
        },
        toBeGreaterThanOrEqual(expected: number) {
            assert.ok((actual as number) >= expected, `Expected ${actual} >= ${expected}`);
        },
        toBeLessThan(expected: number) {
            assert.ok((actual as number) < expected, `Expected ${actual} < ${expected}`);
        },
        toBeLessThanOrEqual(expected: number) {
            assert.ok((actual as number) <= expected, `Expected ${actual} <= ${expected}`);
        },
        toHaveBeenCalledTimes(expected: number) {
            const mock = actual as MockFunction;
            assert.ok(mock._isMock, 'toHaveBeenCalledTimes called on non-mock. Use fn() to create a mock.');
            assert.strictEqual(mock.calls.length, expected, `Expected ${expected} calls, got ${mock.calls.length}`);
        },
        toHaveBeenCalled() {
            const mock = actual as MockFunction;
            assert.ok(mock._isMock, 'toHaveBeenCalled called on non-mock. Use fn() to create a mock.');
            assert.ok(mock.calls.length > 0, `Expected mock to have been called, but it was not called`);
        },
        toHaveBeenCalledWith(...args: unknown[]) {
            const mock = actual as MockFunction;
            assert.ok(mock._isMock, 'toHaveBeenCalledWith called on non-mock. Use fn() to create a mock.');
            const found = mock.calls.some(call => {
                if (call.length !== args.length) return false;
                return args.every((arg, i) => matchesWithAsymmetric(call[i], arg));
            });
            assert.ok(
                found,
                `Expected mock to have been called with ${formatValue(args)}, but calls were: ${formatValue(mock.calls)}`,
            );
        },
        toBeTruthy() {
            assert.ok(actual, `Expected ${formatValue(actual)} to be truthy`);
        },
        toBeFalsy() {
            assert.ok(!actual, `Expected ${formatValue(actual)} to be falsy`);
        },
        toBeNull() {
            assert.strictEqual(actual, null);
        },
        toHaveLength(expected: number) {
            const len = (actual as any).length;
            assert.strictEqual(len, expected, `Expected length ${expected}, got ${len}`);
        },
        toHaveProperty(path: string, value?: unknown) {
            const parts = path.split('.');
            let obj: any = actual;
            for (const part of parts) {
                assert.ok(obj != null && part in obj, `Expected property "${path}" to exist`);
                obj = obj[part];
            }
            if (arguments.length >= 2) {
                if (!jestDeepEqual(obj, value)) {
                    assert.fail(`Expected property "${path}" to equal ${formatValue(value)}, got ${formatValue(obj)}`);
                }
            }
        },
    };

    const negated: Matchers = {
        toBe(expected: unknown) {
            assert.notStrictEqual(actual, expected);
        },
        toEqual(expected: unknown) {
            if (jestDeepEqual(actual, expected)) {
                assert.fail(`Expected values NOT to be structurally equal:\nValue: ${formatValue(actual)}`);
            }
        },
        toContain(expected: unknown) {
            if (typeof actual === 'string') {
                assert.ok(!actual.includes(expected as string), `Expected string NOT to contain "${expected}"`);
            } else if (Array.isArray(actual)) {
                const found = actual.some(item => Object.is(item, expected) || jestDeepEqual(item, expected));
                assert.ok(!found, `Expected array NOT to contain ${formatValue(expected)}`);
            } else {
                assert.fail(`not.toContain called on non-string, non-array: ${typeof actual}`);
            }
        },
        toMatchObject(expected: object) {
            if (jestMatchObject(actual, expected)) {
                assert.fail(`Expected object NOT to match:\nValue: ${formatValue(actual)}`);
            }
        },
        toMatch(expected: string | RegExp) {
            const str = actual as string;
            if (typeof expected === 'string') {
                assert.ok(!str.includes(expected), `Expected "${str}" NOT to match "${expected}"`);
            } else {
                assert.doesNotMatch(str, expected);
            }
        },
        toThrow() {
            assert.doesNotThrow(actual as () => void);
        },
        toThrowError() {
            negated.toThrow();
        },
        toBeInstanceOf(expected: Function) {
            assert.ok(!(actual instanceof expected), `Expected NOT instance of ${expected.name}`);
        },
        toBeCloseTo(expected: number, numDigits = 2) {
            const precision = Math.pow(10, -numDigits) / 2;
            assert.ok(
                Math.abs((actual as number) - expected) >= precision,
                `Expected ${actual} NOT to be close to ${expected}`,
            );
        },
        toBeDefined() {
            assert.strictEqual(actual, undefined);
        },
        toBeUndefined() {
            assert.notStrictEqual(actual, undefined);
        },
        toBeGreaterThan(expected: number) {
            assert.ok(!((actual as number) > expected), `Expected ${actual} NOT > ${expected}`);
        },
        toBeGreaterThanOrEqual(expected: number) {
            assert.ok(!((actual as number) >= expected), `Expected ${actual} NOT >= ${expected}`);
        },
        toBeLessThan(expected: number) {
            assert.ok(!((actual as number) < expected), `Expected ${actual} NOT < ${expected}`);
        },
        toBeLessThanOrEqual(expected: number) {
            assert.ok(!((actual as number) <= expected), `Expected ${actual} NOT <= ${expected}`);
        },
        toHaveBeenCalledTimes(expected: number) {
            const mock = actual as MockFunction;
            assert.ok(mock._isMock, 'not.toHaveBeenCalledTimes called on non-mock.');
            assert.notStrictEqual(mock.calls.length, expected, `Expected NOT ${expected} calls, but got exactly that`);
        },
        toHaveBeenCalled() {
            const mock = actual as MockFunction;
            assert.ok(mock._isMock, 'not.toHaveBeenCalled called on non-mock.');
            assert.strictEqual(
                mock.calls.length,
                0,
                `Expected mock NOT to have been called, but it was called ${mock.calls.length} times`,
            );
        },
        toHaveBeenCalledWith(...args: unknown[]) {
            const mock = actual as MockFunction;
            assert.ok(mock._isMock, 'not.toHaveBeenCalledWith called on non-mock.');
            const found = mock.calls.some(call => {
                if (call.length !== args.length) return false;
                return args.every((arg, i) => matchesWithAsymmetric(call[i], arg));
            });
            assert.ok(!found, `Expected mock NOT to have been called with ${formatValue(args)}`);
        },
        toBeTruthy() {
            assert.ok(!actual, `Expected ${formatValue(actual)} NOT to be truthy`);
        },
        toBeFalsy() {
            assert.ok(actual, `Expected ${formatValue(actual)} NOT to be falsy`);
        },
        toBeNull() {
            assert.notStrictEqual(actual, null);
        },
        toHaveLength(expected: number) {
            const len = (actual as any).length;
            assert.notStrictEqual(len, expected, `Expected length NOT ${expected}`);
        },
        toHaveProperty(path: string) {
            const parts = path.split('.');
            let obj: any = actual;
            let exists = true;
            for (const part of parts) {
                if (obj == null || !(part in obj)) {
                    exists = false;
                    break;
                }
                obj = obj[part];
            }
            assert.ok(!exists, `Expected property "${path}" NOT to exist`);
        },
    };

    // Build rejects/resolves async matchers
    const rejectsMatchers: AsyncMatchers = {} as any;
    const resolvesMatchers: AsyncMatchers = {} as any;

    for (const key of [
        'toBe',
        'toEqual',
        'toContain',
        'toMatchObject',
        'toMatch',
        'toThrow',
        'toThrowError',
        'toBeInstanceOf',
        'toBeDefined',
        'toBeUndefined',
        'toBeTruthy',
        'toBeFalsy',
    ] as const) {
        (rejectsMatchers as any)[key] = async (...args: any[]) => {
            try {
                const value = typeof actual === 'function' ? actual() : actual;
                await value;
                assert.fail(`Expected promise to reject, but it resolved`);
            } catch (err: any) {
                if (key === 'toThrow' || key === 'toThrowError') {
                    if (args.length === 0) return; // just checking it throws
                    const expected = args[0];
                    if (typeof expected === 'string') {
                        assert.ok(
                            err.message?.includes(expected),
                            `Expected error message to contain "${expected}", got "${err.message}"`,
                        );
                    } else if (expected instanceof RegExp) {
                        assert.match(err.message, expected);
                    } else if (typeof expected === 'function') {
                        assert.ok(
                            err instanceof expected,
                            `Expected error to be instance of ${expected.name}, got ${err.constructor?.name}`,
                        );
                    }
                } else if (key === 'toBeInstanceOf') {
                    assert.ok(
                        err instanceof args[0],
                        `Expected rejected value to be instance of ${args[0].name}, got ${err.constructor?.name}`,
                    );
                } else if (key === 'toMatchObject') {
                    if (!jestMatchObject(err, args[0])) {
                        assert.fail(
                            `Expected rejected value to match object:\nActual: ${formatValue(err)}\nExpected: ${formatValue(args[0])}`,
                        );
                    }
                } else {
                    // For other matchers, run them on the rejected error
                    (expectImpl(err) as any)[key](...args);
                }
            }
        };
        (resolvesMatchers as any)[key] = async (...args: any[]) => {
            const value = typeof actual === 'function' ? actual() : actual;
            const result = await value;
            (expectImpl(result) as any)[key](...args);
        };
    }

    return { ...matchers, not: negated, rejects: rejectsMatchers, resolves: resolvesMatchers };
}

function _expect(actual: unknown): Expect {
    return expectImpl(actual);
}

_expect.any = function (constructor: Function): AsymmetricMatcher {
    return {
        [ASYMMETRIC]: true,
        check(actual: unknown) {
            if (constructor === String) return typeof actual === 'string';
            if (constructor === Number) return typeof actual === 'number';
            if (constructor === Boolean) return typeof actual === 'boolean';
            if (constructor === BigInt) return typeof actual === 'bigint';
            if (constructor === Symbol) return typeof actual === 'symbol';
            if (constructor === Function) return typeof actual === 'function';
            return actual instanceof constructor;
        },
        toString() {
            return `Any<${constructor.name}>`;
        },
    };
};

_expect.anything = function (): AsymmetricMatcher {
    return {
        [ASYMMETRIC]: true,
        check(actual: unknown) {
            return actual !== null && actual !== undefined;
        },
        toString() {
            return 'Anything';
        },
    };
};

_expect.arrayContaining = function (expected: unknown[]): AsymmetricMatcher {
    return {
        [ASYMMETRIC]: true,
        check(actual: unknown) {
            if (!Array.isArray(actual)) return false;
            return expected.every(exp => actual.some(act => matchesWithAsymmetric(act, exp)));
        },
        toString() {
            return `ArrayContaining<${formatValue(expected)}>`;
        },
    };
};

_expect.objectContaining = function (expected: object): AsymmetricMatcher {
    return {
        [ASYMMETRIC]: true,
        check(actual: unknown) {
            if (actual === null || typeof actual !== 'object') return false;
            for (const key of Object.keys(expected)) {
                if (!matchesWithAsymmetric((actual as any)[key], (expected as any)[key])) return false;
            }
            return true;
        },
        toString() {
            return `ObjectContaining<${formatValue(expected)}>`;
        },
    };
};

_expect.stringContaining = function (expected: string): AsymmetricMatcher {
    return {
        [ASYMMETRIC]: true,
        check(actual: unknown) {
            return typeof actual === 'string' && actual.includes(expected);
        },
        toString() {
            return `StringContaining<${expected}>`;
        },
    };
};

export const expect: ExpectStatic = _expect as ExpectStatic;

/**
 * Lightweight jest.fn() replacement.
 * Records calls and arguments. Supports mockImplementation.
 */
interface MockFunction {
    (...args: any[]): any;
    _isMock: true;
    calls: any[][];
    mockImplementation(impl: (...args: any[]) => any): MockFunction;
    mockReturnValue(value: any): MockFunction;
    mockClear(): void;
}

export function fn(impl?: (...args: any[]) => any): MockFunction {
    let implementation = impl || (() => undefined);
    const calls: any[][] = [];

    const mock = function (...args: any[]) {
        calls.push(args);
        return implementation(...args);
    } as MockFunction;

    mock._isMock = true;
    mock.calls = calls;
    mock.mockImplementation = (newImpl: (...args: any[]) => any) => {
        implementation = newImpl;
        return mock;
    };
    mock.mockReturnValue = (value: any) => {
        implementation = () => value;
        return mock;
    };
    mock.mockClear = () => {
        calls.length = 0;
    };

    return mock;
}

/**
 * Lightweight jest.spyOn() replacement.
 * Wraps the original method with a mock that records calls and delegates to the original.
 * Call mockRestore() to restore the original method.
 */
export function spyOn(obj: any, method: string): MockFunction & { mockRestore(): void } {
    const original = obj[method];
    const spy = fn((...args: any[]) => original.apply(obj, args)) as MockFunction & { mockRestore(): void };
    spy.mockRestore = () => {
        obj[method] = original;
    };
    obj[method] = spy;
    return spy;
}
