import { describe, expect, test } from '@jest/globals';

import { Builder, Ref, VarRef, arg, canJIT, fn, fnExec, fnJIT, getJitThreshold, getRuntimeCapabilities, setJitThreshold } from '../src/jit.js';

describe('jit2', () => {
    describe('runtime detection', () => {
        test('canJIT is boolean', () => {
            expect(typeof canJIT).toBe('boolean');
        });

        test('getRuntimeCapabilities returns valid object', () => {
            const caps = getRuntimeCapabilities();
            expect(typeof caps.newFunction).toBe('boolean');
            expect(['node', 'deno', 'bun', 'cloudflare', 'browser', 'unknown']).toContain(caps.runtime);
        });

        test('canJIT matches getRuntimeCapabilities', () => {
            expect(canJIT).toBe(getRuntimeCapabilities().newFunction);
        });
    });

    // Helper to run tests in both JIT and Exec modes
    function testBothModes(name: string, testFn: (fnBuilder: typeof fn) => void) {
        describe(name, () => {
            test('JIT mode', () => testFn(fnJIT));
            test('Exec mode', () => testFn(fnExec));
        });
    }

    describe('basics', () => {
        testBothModes('returns primitive value', fn => {
            const f = fn(b => b.lit(42));
            expect(f()).toBe(42);
        });

        testBothModes('returns string literal', fn => {
            const f = fn(b => b.lit('hello'));
            expect(f()).toBe('hello');
        });

        testBothModes('returns null literal', fn => {
            const f = fn(b => b.lit(null));
            expect(f()).toBe(null);
        });

        testBothModes('returns undefined literal', fn => {
            const f = fn(b => b.lit(undefined));
            expect(f()).toBe(undefined);
        });

        testBothModes('passes through argument', fn => {
            const f = fn(arg<number>(), (b, x) => x);
            expect(f(123)).toBe(123);
        });

        testBothModes('passes through multiple arguments', fn => {
            const f = fn(arg<number>(), arg<string>(), (b, a, bArg) => {
                const result = b.let(b.emptyArr());
                b.push(result, a);
                b.push(result, bArg);
                return result;
            });
            expect(f(1, 'two')).toEqual([1, 'two']);
        });
    });

    describe('object operations', () => {
        testBothModes('creates empty object', fn => {
            const f = fn(b => b.let(b.emptyObj()));
            expect(f()).toEqual({});
        });

        testBothModes('sets property with string key', fn => {
            const f = fn(b => {
                const obj = b.let(b.emptyObj());
                b.set(obj, 'name', b.lit('John'));
                return obj;
            });
            expect(f()).toEqual({ name: 'John' });
        });

        testBothModes('sets property with ref key', fn => {
            const f = fn(arg<string>(), (b, key) => {
                const obj = b.let(b.emptyObj());
                b.set(obj, key, b.lit('value'));
                return obj;
            });
            expect(f('dynamic')).toEqual({ dynamic: 'value' });
        });

        testBothModes('gets property with string key', fn => {
            const f = fn(arg<any>(), (b, input) => {
                return b.get(input, 'name');
            });
            expect(f({ name: 'Alice' })).toBe('Alice');
        });

        testBothModes('gets property with ref key', fn => {
            const f = fn(arg<any>(), arg<string>(), (b, input, key) => {
                return b.get(input, key);
            });
            expect(f({ foo: 'bar' }, 'foo')).toBe('bar');
        });

        testBothModes('checks property existence with has()', fn => {
            const f = fn(arg<any>(), (b, input) => {
                return b.has(input, 'name');
            });
            expect(f({ name: 'test' })).toBe(true);
            expect(f({ other: 'test' })).toBe(false);
        });

        testBothModes('copies object properties', fn => {
            const f = fn(arg<any>(), (b, input) => {
                const output = b.let(b.emptyObj());
                b.set(output, 'id', b.get(input, 'id'));
                b.set(output, 'name', b.get(input, 'name'));
                return output;
            });
            expect(f({ id: 1, name: 'Test', extra: 'ignored' })).toEqual({ id: 1, name: 'Test' });
        });

        testBothModes('creates object with obj() using array syntax', fn => {
            const f = fn(arg<any>(), (b, input) => {
                return b.obj([
                    ['id', b.get(input, 'id')],
                    ['name', b.get(input, 'name')],
                ]);
            });
            expect(f({ id: 1, name: 'Test', extra: 'ignored' })).toEqual({ id: 1, name: 'Test' });
        });

        testBothModes('creates object with obj() using record syntax', fn => {
            const f = fn(arg<any>(), (b, input) => {
                return b.obj({
                    id: b.get(input, 'id'),
                    name: b.get(input, 'name'),
                });
            });
            expect(f({ id: 1, name: 'Test', extra: 'ignored' })).toEqual({ id: 1, name: 'Test' });
        });

        testBothModes('creates object with non-identifier keys', fn => {
            const f = fn(arg<any>(), (b, input) => {
                return b.obj([
                    ['weird-key', b.get(input, 'a')],
                    ['123start', b.get(input, 'b')],
                ]);
            });
            expect(f({ a: 'valueA', b: 'valueB' })).toEqual({ 'weird-key': 'valueA', '123start': 'valueB' });
        });

        testBothModes('creates object with dynamic ref keys', fn => {
            const f = fn(arg<any>(), arg<string>(), (b, input, keyName) => {
                return b.obj([[keyName, b.get(input, 'value')]]);
            });
            expect(f({ value: 42 }, 'dynamic')).toEqual({ dynamic: 42 });
        });

        testBothModes('chainable property access', fn => {
            const f = fn(arg<any>(), (b, input) => {
                return input.get('address').get('city');
            });
            expect(f({ address: { city: 'NYC' } })).toBe('NYC');
        });
    });

    describe('array operations', () => {
        testBothModes('creates empty array', fn => {
            const f = fn(b => b.let(b.emptyArr()));
            expect(f()).toEqual([]);
        });

        testBothModes('pushes to array', fn => {
            const f = fn(b => {
                const arr = b.let(b.emptyArr());
                b.push(arr, b.lit(1));
                b.push(arr, b.lit(2));
                b.push(arr, b.lit(3));
                return arr;
            });
            expect(f()).toEqual([1, 2, 3]);
        });

        testBothModes('creates array with arr()', fn => {
            const f = fn(b => {
                return b.arr(b.lit(1), b.lit(2), b.lit(3));
            });
            expect(f()).toEqual([1, 2, 3]);
        });

        testBothModes('gets array element with at()', fn => {
            const f = fn(arg<number[]>(), (b, arr) => {
                return b.at(arr, 1);
            });
            expect(f([10, 20, 30])).toBe(20);
        });

        testBothModes('gets array element with dynamic index', fn => {
            const f = fn(arg<number[]>(), arg<number>(), (b, arr, idx) => {
                return b.at(arr, idx);
            });
            expect(f([10, 20, 30], 2)).toBe(30);
        });

        testBothModes('chainable at()', fn => {
            const f = fn(arg<number[]>(), (b, arr) => {
                return arr.at(1);
            });
            expect(f([10, 20, 30])).toBe(20);
        });

        testBothModes('gets array length', fn => {
            const f = fn(arg<any[]>(), (b, arr) => {
                return b.len(arr);
            });
            expect(f([1, 2, 3, 4, 5])).toBe(5);
            expect(f([])).toBe(0);
        });

        testBothModes('chainable len()', fn => {
            const f = fn(arg<any[]>(), (b, arr) => {
                return arr.len();
            });
            expect(f([1, 2, 3])).toBe(3);
        });

        testBothModes('gets string length', fn => {
            const f = fn(arg<string>(), (b, str) => {
                return b.len(str);
            });
            expect(f('hello')).toBe(5);
        });
    });

    describe('equality operations', () => {
        testBothModes('strict equality with eq()', fn => {
            const f = fn(arg<any>(), arg<any>(), (b, a, bArg) => {
                return b.eq(a, bArg);
            });
            expect(f(1, 1)).toBe(true);
            expect(f(1, '1')).toBe(false);
            expect(f(null, null)).toBe(true);
            expect(f(undefined, undefined)).toBe(true);
            expect(f(null, undefined)).toBe(false);
        });

        testBothModes('strict inequality with neq()', fn => {
            const f = fn(arg<any>(), arg<any>(), (b, a, bArg) => {
                return b.neq(a, bArg);
            });
            expect(f(1, 2)).toBe(true);
            expect(f(1, 1)).toBe(false);
            expect(f(1, '1')).toBe(true);
        });
    });

    describe('comparison operations', () => {
        testBothModes('less than with lt()', fn => {
            const f = fn(arg<number>(), arg<number>(), (b, a, bArg) => {
                return b.lt(a, bArg);
            });
            expect(f(1, 2)).toBe(true);
            expect(f(2, 2)).toBe(false);
            expect(f(3, 2)).toBe(false);
        });

        testBothModes('greater than with gt()', fn => {
            const f = fn(arg<number>(), arg<number>(), (b, a, bArg) => {
                return b.gt(a, bArg);
            });
            expect(f(3, 2)).toBe(true);
            expect(f(2, 2)).toBe(false);
            expect(f(1, 2)).toBe(false);
        });

        testBothModes('less than or equal with lte()', fn => {
            const f = fn(arg<number>(), arg<number>(), (b, a, bArg) => {
                return b.lte(a, bArg);
            });
            expect(f(1, 2)).toBe(true);
            expect(f(2, 2)).toBe(true);
            expect(f(3, 2)).toBe(false);
        });

        testBothModes('greater than or equal with gte()', fn => {
            const f = fn(arg<number>(), arg<number>(), (b, a, bArg) => {
                return b.gte(a, bArg);
            });
            expect(f(3, 2)).toBe(true);
            expect(f(2, 2)).toBe(true);
            expect(f(1, 2)).toBe(false);
        });
    });

    describe('logical operations', () => {
        testBothModes('negation with not()', fn => {
            const f = fn(arg<boolean>(), (b, a) => {
                return b.not(a);
            });
            expect(f(true)).toBe(false);
            expect(f(false)).toBe(true);
        });

        testBothModes('logical AND with and()', fn => {
            const f = fn(arg<boolean>(), arg<boolean>(), (b, a, bArg) => {
                return b.and(a, bArg);
            });
            expect(f(true, true)).toBe(true);
            expect(f(true, false)).toBe(false);
            expect(f(false, true)).toBe(false);
            expect(f(false, false)).toBe(false);
        });

        testBothModes('logical OR with or()', fn => {
            const f = fn(arg<boolean>(), arg<boolean>(), (b, a, bArg) => {
                return b.or(a, bArg);
            });
            expect(f(true, true)).toBe(true);
            expect(f(true, false)).toBe(true);
            expect(f(false, true)).toBe(true);
            expect(f(false, false)).toBe(false);
        });

        testBothModes('nullish coalescing with nullish()', fn => {
            const f = fn(arg<any>(), (b, a) => {
                return b.nullish(a, b.lit('default'));
            });
            expect(f(null)).toBe('default');
            expect(f(undefined)).toBe('default');
            expect(f(0)).toBe(0);
            expect(f('')).toBe('');
            expect(f('value')).toBe('value');
        });
    });

    describe('type checks', () => {
        testBothModes('typeof check with isType()', fn => {
            const isString = fn(arg<any>(), (b, v) => b.isType(v, 'string'));
            const isNumber = fn(arg<any>(), (b, v) => b.isType(v, 'number'));
            const isObject = fn(arg<any>(), (b, v) => b.isType(v, 'object'));
            const isFunction = fn(arg<any>(), (b, v) => b.isType(v, 'function'));

            expect(isString('hello')).toBe(true);
            expect(isString(123)).toBe(false);
            expect(isNumber(123)).toBe(true);
            expect(isNumber('123')).toBe(false);
            expect(isObject({})).toBe(true);
            expect(isObject(null)).toBe(true); // typeof null === 'object'
            expect(isFunction(() => {})).toBe(true);
        });

        testBothModes('typeof_ returns type string', fn => {
            const f = fn(arg<any>(), (b, v) => b.typeof_(v));
            expect(f('hello')).toBe('string');
            expect(f(123)).toBe('number');
            expect(f(true)).toBe('boolean');
            expect(f({})).toBe('object');
            expect(f(() => {})).toBe('function');
        });

        testBothModes('null check with isNull()', fn => {
            const f = fn(arg<any>(), (b, v) => b.isNull(v));
            expect(f(null)).toBe(true);
            expect(f(undefined)).toBe(false);
            expect(f(0)).toBe(false);
            expect(f('')).toBe(false);
            expect(f({})).toBe(false);
        });

        testBothModes('nullish check with isNullish()', fn => {
            const f = fn(arg<any>(), (b, v) => b.isNullish(v));
            expect(f(null)).toBe(true);
            expect(f(undefined)).toBe(true);
            expect(f(0)).toBe(false);
            expect(f('')).toBe(false);
            expect(f(false)).toBe(false);
        });
    });

    describe('function calls', () => {
        testBothModes('calls external function with call()', fn => {
            const double = (x: number) => x * 2;
            const f = fn(arg<number>(), (b, x) => {
                return b.call(double, x);
            });
            expect(f(5)).toBe(10);
            expect(f(21)).toBe(42);
        });

        testBothModes('calls function with multiple args', fn => {
            const add = (a: number, bArg: number, c: number) => a + bArg + c;
            const f = fn(arg<number>(), arg<number>(), arg<number>(), (b, a, bArg, c) => {
                return b.call(add, a, bArg, c);
            });
            expect(f(1, 2, 3)).toBe(6);
        });

        testBothModes('creates instance with new_()', fn => {
            class Point {
                constructor(
                    public x: number,
                    public y: number,
                ) {}
            }
            const f = fn(arg<number>(), arg<number>(), (b, x, y) => {
                return b.new_(Point, x, y);
            });
            const point = f(10, 20);
            expect(point).toBeInstanceOf(Point);
            expect(point.x).toBe(10);
            expect(point.y).toBe(20);
        });
    });

    describe('control flow - if_()', () => {
        testBothModes('executes then branch when true', fn => {
            const f = fn(arg<boolean>(), (b, cond) => {
                const result = b.let(b.emptyObj());
                b.if_(
                    cond,
                    () => {
                        b.set(result, 'branch', b.lit('then'));
                    },
                    () => {
                        b.set(result, 'branch', b.lit('else'));
                    },
                );
                return result;
            });
            expect(f(true)).toEqual({ branch: 'then' });
            expect(f(false)).toEqual({ branch: 'else' });
        });

        testBothModes('early return from then branch', fn => {
            const f = fn(arg<any>(), (b, input) => {
                b.if_(b.isNull(input), () => {
                    return b.lit('was null');
                });
                return b.lit('not null');
            });
            expect(f(null)).toBe('was null');
            expect(f('value')).toBe('not null');
        });

        testBothModes('early return from else branch', fn => {
            const f = fn(arg<boolean>(), (b, cond) => {
                b.if_(
                    cond,
                    () => {
                        return b.lit('from then');
                    },
                    () => {
                        return b.lit('from else');
                    },
                );
                return b.lit('never reached');
            });
            expect(f(true)).toBe('from then');
            expect(f(false)).toBe('from else');
        });

        testBothModes('nested if_ statements', fn => {
            const f = fn(arg<number>(), (b, n) => {
                const result = b.let(b.emptyObj());
                b.if_(
                    b.lt(n, b.lit(0)),
                    () => {
                        b.set(result, 'sign', b.lit('negative'));
                    },
                    () => {
                        b.if_(
                            b.gt(n, b.lit(0)),
                            () => {
                                b.set(result, 'sign', b.lit('positive'));
                            },
                            () => {
                                b.set(result, 'sign', b.lit('zero'));
                            },
                        );
                    },
                );
                return result;
            });
            expect(f(-5)).toEqual({ sign: 'negative' });
            expect(f(5)).toEqual({ sign: 'positive' });
            expect(f(0)).toEqual({ sign: 'zero' });
        });
    });

    describe('control flow - loop()', () => {
        testBothModes('iterates over array', fn => {
            const f = fn(arg<number[]>(), (b, arr) => {
                const result = b.let(b.emptyArr());
                b.loop(arr, (elem, idx) => {
                    b.push(result, elem);
                });
                return result;
            });
            expect(f([1, 2, 3])).toEqual([1, 2, 3]);
        });

        testBothModes('provides correct index', fn => {
            const f = fn(arg<string[]>(), (b, arr) => {
                const result = b.let(b.emptyArr());
                b.loop(arr, (elem, idx) => {
                    b.push(result, idx);
                });
                return result;
            });
            expect(f(['a', 'b', 'c'])).toEqual([0, 1, 2]);
        });

        testBothModes('transforms array elements', fn => {
            const double = (x: number) => x * 2;
            const f = fn(arg<number[]>(), (b, arr) => {
                const result = b.let(b.emptyArr());
                b.loop(arr, (elem, idx) => {
                    b.push(result, b.call(double, elem));
                });
                return result;
            });
            expect(f([1, 2, 3])).toEqual([2, 4, 6]);
        });

        testBothModes('handles empty array', fn => {
            const f = fn(arg<any[]>(), (b, arr) => {
                const result = b.let(b.emptyArr());
                b.loop(arr, elem => {
                    b.push(result, elem);
                });
                return result;
            });
            expect(f([])).toEqual([]);
        });

        testBothModes('early return inside loop', fn => {
            const f = fn(arg<number[]>(), (b, arr) => {
                const result = b.let(b.emptyArr());
                b.loop(arr, elem => {
                    b.if_(b.eq(elem, b.lit(3)), () => {
                        return b.lit('found 3');
                    });
                    b.push(result, elem);
                });
                return result;
            });
            expect(f([1, 2, 3, 4, 5])).toBe('found 3');
            expect(f([1, 2, 4, 5])).toEqual([1, 2, 4, 5]);
        });
    });

    describe('control flow - map()', () => {
        testBothModes('maps array elements', fn => {
            const f = fn(arg<number[]>(), (b, arr) => {
                return b.map(arr, (elem, idx) => elem);
            });
            expect(f([1, 2, 3])).toEqual([1, 2, 3]);
        });

        testBothModes('transforms elements with callback', fn => {
            const double = (x: number) => x * 2;
            const f = fn(arg<number[]>(), (b, arr) => {
                return b.map(arr, elem => b.call(double, elem));
            });
            expect(f([1, 2, 3])).toEqual([2, 4, 6]);
        });

        testBothModes('maps to object literals', fn => {
            const f = fn(arg<any[]>(), (b, arr) => {
                return b.map(arr, elem => {
                    return b.obj({
                        id: b.get(elem, 'id'),
                        name: b.get(elem, 'name'),
                    });
                });
            });
            const input = [
                { id: 1, name: 'Alice' },
                { id: 2, name: 'Bob' },
            ];
            expect(f(input)).toEqual([
                { id: 1, name: 'Alice' },
                { id: 2, name: 'Bob' },
            ]);
        });

        testBothModes('provides correct index', fn => {
            const f = fn(arg<string[]>(), (b, arr) => {
                return b.map(arr, (elem, idx) => idx);
            });
            expect(f(['a', 'b', 'c'])).toEqual([0, 1, 2]);
        });

        testBothModes('handles empty array', fn => {
            const f = fn(arg<any[]>(), (b, arr) => {
                return b.map(arr, elem => elem);
            });
            expect(f([])).toEqual([]);
        });
    });

    describe('control flow - forIn()', () => {
        testBothModes('iterates over object keys', fn => {
            const f = fn(arg<any>(), (b, obj) => {
                const keys = b.let(b.emptyArr());
                b.forIn(obj, (key, value) => {
                    b.push(keys, key);
                });
                return keys;
            });
            expect(f({ a: 1, b: 2, c: 3 }).sort()).toEqual(['a', 'b', 'c']);
        });

        testBothModes('provides key and value', fn => {
            const f = fn(arg<any>(), (b, obj) => {
                const pairs = b.let(b.emptyArr());
                b.forIn(obj, (key, value) => {
                    b.push(pairs, b.arr(key, value));
                });
                return pairs;
            });
            const result = f({ x: 10, y: 20 });
            expect(result.sort()).toEqual(
                [
                    ['x', 10],
                    ['y', 20],
                ].sort(),
            );
        });
    });

    describe('mutable state - var_/setVar/getVar', () => {
        testBothModes('creates mutable variable and reads it back', fn => {
            const f = fn(b => {
                const counter = b.var_(0);
                return b.getVar(counter);
            });
            expect(f()).toBe(0);
        });

        testBothModes('sets and gets mutable variable', fn => {
            const f = fn(b => {
                const counter = b.var_(0);
                b.setVar(counter, b.lit(42));
                return b.getVar(counter);
            });
            expect(f()).toBe(42);
        });

        testBothModes('tracks state across conditionals', fn => {
            const f = fn(arg<boolean>(), (b, shouldChange) => {
                const state = b.var_(false);
                b.if_(shouldChange, () => {
                    b.setVar(state, b.lit(true));
                });
                return b.getVar(state);
            });
            expect(f(true)).toBe(true);
            expect(f(false)).toBe(false);
        });

        testBothModes('multiple mutations', fn => {
            const f = fn(b => {
                const counter = b.var_(0);
                b.setVar(counter, b.lit(1));
                b.setVar(counter, b.lit(2));
                b.setVar(counter, b.lit(3));
                return b.getVar(counter);
            });
            expect(f()).toBe(3);
        });

        testBothModes('initializes from ref', fn => {
            const f = fn(arg<number>(), (b, initialValue) => {
                const counter = b.var_(initialValue);
                return b.getVar(counter);
            });
            expect(f(100)).toBe(100);
        });

        testBothModes('multiple independent variables', fn => {
            const f = fn(b => {
                const a = b.var_(1);
                const bVar = b.var_(2);
                b.setVar(a, b.lit(10));
                b.setVar(bVar, b.lit(20));
                const arr = b.let(b.emptyArr());
                b.push(arr, b.getVar(a));
                b.push(arr, b.getVar(bVar));
                return arr;
            });
            expect(f()).toEqual([10, 20]);
        });

        testBothModes('variable state persists in loop', fn => {
            const f = fn(arg<number[]>(), (b, arr) => {
                const sum = b.var_(0);
                const add = (a: number, bArg: number) => a + bArg;
                b.loop(arr, (elem, idx) => {
                    const current = b.getVar(sum);
                    b.setVar(sum, b.call(add, current, elem));
                });
                return b.getVar(sum);
            });
            expect(f([1, 2, 3, 4, 5])).toBe(15);
        });

        testBothModes('change detection pattern', fn => {
            const f = fn(arg<any>(), arg<any>(), (b, oldObj, newObj) => {
                const changed = b.var_(false);
                b.if_(b.neq(b.get(oldObj, 'name'), b.get(newObj, 'name')), () => {
                    b.setVar(changed, b.lit(true));
                });
                b.if_(b.neq(b.get(oldObj, 'age'), b.get(newObj, 'age')), () => {
                    b.setVar(changed, b.lit(true));
                });
                return b.getVar(changed);
            });
            expect(f({ name: 'John', age: 30 }, { name: 'John', age: 30 })).toBe(false);
            expect(f({ name: 'John', age: 30 }, { name: 'Jane', age: 30 })).toBe(true);
            expect(f({ name: 'John', age: 30 }, { name: 'John', age: 31 })).toBe(true);
        });
    });

    describe('switch statement - switch_', () => {
        testBothModes('matches case and returns', fn => {
            const f = fn(arg<string>(), (b, kind) => {
                b.switch_(kind, [
                    ['string', () => b.lit('is string')],
                    ['number', () => b.lit('is number')],
                    ['boolean', () => b.lit('is boolean')],
                ]);
                return b.lit('unknown');
            });
            expect(f('string')).toBe('is string');
            expect(f('number')).toBe('is number');
            expect(f('boolean')).toBe('is boolean');
            expect(f('other')).toBe('unknown');
        });

        testBothModes('matches default case', fn => {
            const f = fn(arg<number>(), (b, n) => {
                b.switch_(
                    n,
                    [
                        [1, () => b.lit('one')],
                        [2, () => b.lit('two')],
                    ],
                    () => b.lit('other'),
                );
                return b.lit('never');
            });
            expect(f(1)).toBe('one');
            expect(f(2)).toBe('two');
            expect(f(3)).toBe('other');
        });

        testBothModes('executes case body without return', fn => {
            const f = fn(arg<string>(), (b, action) => {
                const result = b.let(b.emptyObj());
                b.switch_(action, [
                    [
                        'add',
                        () => {
                            b.set(result, 'op', b.lit('addition'));
                        },
                    ],
                    [
                        'sub',
                        () => {
                            b.set(result, 'op', b.lit('subtraction'));
                        },
                    ],
                ]);
                return result;
            });
            expect(f('add')).toEqual({ op: 'addition' });
            expect(f('sub')).toEqual({ op: 'subtraction' });
            expect(f('other')).toEqual({});
        });

        testBothModes('handles numeric cases', fn => {
            const f = fn(arg<number>(), (b, kind) => {
                b.switch_(kind, [
                    [1, () => b.lit('type 1')],
                    [2, () => b.lit('type 2')],
                    [42, () => b.lit('type 42')],
                ]);
                return b.lit('unknown type');
            });
            expect(f(1)).toBe('type 1');
            expect(f(2)).toBe('type 2');
            expect(f(42)).toBe('type 42');
            expect(f(999)).toBe('unknown type');
        });

        testBothModes('type dispatch pattern', fn => {
            const serialize = fn(arg<any>(), arg<string>(), (b, value, typeName) => {
                b.switch_(typeName, [
                    ['string', () => value],
                    ['number', () => b.call(String, value)],
                    ['boolean', () => b.ternary(value, b.lit('true'), b.lit('false'))],
                ]);
                return b.lit(null);
            });
            expect(serialize('hello', 'string')).toBe('hello');
            expect(serialize(42, 'number')).toBe('42');
            expect(serialize(true, 'boolean')).toBe('true');
            expect(serialize(false, 'boolean')).toBe('false');
            expect(serialize(undefined, 'unknown')).toBe(null);
        });
    });

    describe('ternary expression', () => {
        testBothModes('returns then value when true', fn => {
            const f = fn(arg<boolean>(), (b, cond) => {
                return b.ternary(cond, b.lit('yes'), b.lit('no'));
            });
            expect(f(true)).toBe('yes');
            expect(f(false)).toBe('no');
        });

        testBothModes('works with refs from input', fn => {
            const f = fn(arg<any>(), (b, input) => {
                return b.ternary(b.get(input, 'enabled'), b.get(input, 'a'), b.get(input, 'b'));
            });
            expect(f({ enabled: true, a: 'first', b: 'second' })).toBe('first');
            expect(f({ enabled: false, a: 'first', b: 'second' })).toBe('second');
        });

        testBothModes('nested ternary', fn => {
            const f = fn(arg<number>(), (b, n) => {
                return b.ternary(b.lt(n, b.lit(0)), b.lit('negative'), b.ternary(b.gt(n, b.lit(0)), b.lit('positive'), b.lit('zero')));
            });
            expect(f(-5)).toBe('negative');
            expect(f(5)).toBe('positive');
            expect(f(0)).toBe('zero');
        });

        testBothModes('ternary with object creation', fn => {
            const f = fn(arg<boolean>(), (b, useAlt) => {
                return b.ternary(useAlt, b.obj({ value: b.lit('alternative') }), b.obj({ value: b.lit('default') }));
            });
            expect(f(true)).toEqual({ value: 'alternative' });
            expect(f(false)).toEqual({ value: 'default' });
        });

        testBothModes('ternary in combination with var_', fn => {
            const f = fn(arg<number>(), (b, n) => {
                const result = b.var_(b.lit(''));
                b.setVar(result, b.ternary(b.gt(n, b.lit(10)), b.lit('big'), b.lit('small')));
                return b.getVar(result);
            });
            expect(f(15)).toBe('big');
            expect(f(5)).toBe('small');
        });
    });

    describe('instance check - isInstance', () => {
        testBothModes('checks Date instance', fn => {
            const f = fn(arg<any>(), (b, value) => {
                return b.isInstance(value, Date);
            });
            expect(f(new Date())).toBe(true);
            expect(f('2024-01-01')).toBe(false);
            expect(f({})).toBe(false);
        });

        testBothModes('checks Array instance', fn => {
            const f = fn(arg<any>(), (b, value) => {
                return b.isInstance(value, Array);
            });
            expect(f([1, 2, 3])).toBe(true);
            expect(f({ length: 3 })).toBe(false);
            expect(f('array')).toBe(false);
        });

        testBothModes('checks custom class instance', fn => {
            class MyClass {
                constructor(public value: number) {}
            }
            const f = fn(arg<any>(), (b, value) => {
                return b.isInstance(value, MyClass);
            });
            expect(f(new MyClass(42))).toBe(true);
            expect(f({ value: 42 })).toBe(false);
            expect(f(null)).toBe(false);
        });

        testBothModes('checks Error instance', fn => {
            const f = fn(arg<any>(), (b, value) => {
                return b.isInstance(value, Error);
            });
            expect(f(new Error('test'))).toBe(true);
            expect(f(new TypeError('test'))).toBe(true);
            expect(f({ message: 'test' })).toBe(false);
        });

        testBothModes('uses isInstance in conditional', fn => {
            const f = fn(arg<any>(), (b, value) => {
                b.if_(b.isInstance(value, Date), () => {
                    return b.lit('is date');
                });
                b.if_(b.isInstance(value, Array), () => {
                    return b.lit('is array');
                });
                return b.lit('unknown');
            });
            expect(f(new Date())).toBe('is date');
            expect(f([1, 2, 3])).toBe('is array');
            expect(f('string')).toBe('unknown');
        });

        testBothModes('combines isInstance with other type checks', fn => {
            const f = fn(arg<any>(), (b, value) => {
                b.if_(b.isNullish(value), () => {
                    return b.lit('nullish');
                });
                b.if_(b.isInstance(value, Date), () => {
                    return b.lit('date');
                });
                b.if_(b.isType(value, 'string'), () => {
                    return b.lit('string');
                });
                return b.lit('other');
            });
            expect(f(null)).toBe('nullish');
            expect(f(undefined)).toBe('nullish');
            expect(f(new Date())).toBe('date');
            expect(f('hello')).toBe('string');
            expect(f(42)).toBe('other');
        });
    });

    describe('cond() - else-if chains', () => {
        testBothModes('matches first true condition', fn => {
            const f = fn(arg<number>(), (b, n) => {
                b.cond(
                    [
                        [b.lt(n, b.lit(0)), () => b.lit('negative')],
                        [b.gt(n, b.lit(0)), () => b.lit('positive')],
                    ],
                    () => b.lit('zero'),
                );
                return b.lit('unreachable');
            });
            expect(f(-5)).toBe('negative');
            expect(f(5)).toBe('positive');
            expect(f(0)).toBe('zero');
        });

        testBothModes('multiple conditions', fn => {
            const f = fn(arg<number>(), (b, score) => {
                b.cond(
                    [
                        [b.gte(score, b.lit(90)), () => b.lit('A')],
                        [b.gte(score, b.lit(80)), () => b.lit('B')],
                        [b.gte(score, b.lit(70)), () => b.lit('C')],
                        [b.gte(score, b.lit(60)), () => b.lit('D')],
                    ],
                    () => b.lit('F'),
                );
                return b.lit('unreachable');
            });
            expect(f(95)).toBe('A');
            expect(f(85)).toBe('B');
            expect(f(75)).toBe('C');
            expect(f(65)).toBe('D');
            expect(f(55)).toBe('F');
        });
    });

    describe('throw_() and error handling', () => {
        testBothModes('throws error', fn => {
            const f = fn(arg<boolean>(), (b, shouldThrow) => {
                b.if_(shouldThrow, () => {
                    b.throw_(b.new_(Error, b.lit('test error')));
                });
                return b.lit('ok');
            });
            expect(f(false)).toBe('ok');
            expect(() => f(true)).toThrow('test error');
        });
    });

    describe('concat() - string concatenation', () => {
        testBothModes('concatenates strings', fn => {
            const f = fn(arg<string>(), arg<string>(), (b, a, bArg) => {
                return b.concat(a, b.lit(' '), bArg);
            });
            expect(f('Hello', 'World')).toBe('Hello World');
        });

        testBothModes('concatenates mixed types', fn => {
            const f = fn(arg<string>(), arg<number>(), (b, name, age) => {
                return b.concat(name, b.lit(' is '), age, b.lit(' years old'));
            });
            expect(f('Alice', 30)).toBe('Alice is 30 years old');
        });

        testBothModes('handles empty concat', fn => {
            const f = fn(b => b.concat());
            expect(f()).toBe('');
        });

        testBothModes('handles single element concat', fn => {
            const f = fn(arg<number>(), (b, n) => b.concat(n));
            expect(f(42)).toBe('42');
        });
    });

    describe('exec() - side effects', () => {
        testBothModes('executes for side effects', fn => {
            let sideEffect = 0;
            const increment = () => {
                sideEffect++;
            };

            const f = fn(b => {
                b.exec(b.call(increment));
                b.exec(b.call(increment));
                return b.lit('done');
            });

            sideEffect = 0;
            expect(f()).toBe('done');
            expect(sideEffect).toBe(2);
        });
    });

    describe('edge cases', () => {
        testBothModes('handles special string values', fn => {
            const f = fn(b => {
                return b.obj({
                    quote: b.lit('say "hello"'),
                    newline: b.lit('line1\nline2'),
                    backslash: b.lit('path\\to\\file'),
                });
            });
            expect(f()).toEqual({
                quote: 'say "hello"',
                newline: 'line1\nline2',
                backslash: 'path\\to\\file',
            });
        });

        testBothModes('handles numeric edge cases', fn => {
            const f = fn(b => {
                return b.obj({
                    inf: b.lit(Infinity),
                    negInf: b.lit(-Infinity),
                    zero: b.lit(0),
                    negZero: b.lit(-0),
                });
            });
            const result = f();
            expect(result.inf).toBe(Infinity);
            expect(result.negInf).toBe(-Infinity);
            expect(result.zero).toBe(0);
            expect(Object.is(result.negZero, -0)).toBe(true);
        });

        testBothModes('handles NaN', fn => {
            const f = fn(b => b.lit(NaN));
            expect(Number.isNaN(f())).toBe(true);
        });

        testBothModes('handles complex objects as literals', fn => {
            const complexObj = { nested: { deep: [1, 2, 3] }, fn: () => 42 };
            const f = fn(b => b.lit(complexObj));
            const result = f();
            expect(result).toBe(complexObj);
            expect(result.fn()).toBe(42);
        });

        testBothModes('handles symbols', fn => {
            const sym = Symbol('test');
            const f = fn(b => b.lit(sym));
            expect(f()).toBe(sym);
        });
    });

    describe('complex scenarios', () => {
        testBothModes('object serializer with property loop', fn => {
            const props = ['id', 'name', 'email'];
            const f = fn(arg<any>(), (b, input) => {
                const output = b.let(b.emptyObj());
                for (const prop of props) {
                    b.set(output, prop, b.get(input, prop));
                }
                return output;
            });
            expect(f({ id: 1, name: 'John', email: 'john@example.com', extra: 'ignored' })).toEqual({
                id: 1,
                name: 'John',
                email: 'john@example.com',
            });
        });

        testBothModes('validator with error collection', fn => {
            const rules = [
                { prop: 'name', check: (v: any) => typeof v === 'string', msg: 'name must be string' },
                { prop: 'age', check: (v: any) => typeof v === 'number' && v >= 0, msg: 'age must be non-negative number' },
            ];
            const f = fn(arg<any>(), (b, input) => {
                const errors = b.let(b.emptyArr());
                for (const rule of rules) {
                    const value = b.get(input, rule.prop);
                    const valid = b.call(rule.check, value);
                    b.if_(b.not(valid), () => {
                        b.push(errors, b.lit(rule.msg));
                    });
                }
                return errors;
            });
            expect(f({ name: 'John', age: 25 })).toEqual([]);
            expect(f({ name: 123, age: 25 })).toEqual(['name must be string']);
            expect(f({ name: 'John', age: -5 })).toEqual(['age must be non-negative number']);
            expect(f({ name: 123, age: -5 })).toEqual(['name must be string', 'age must be non-negative number']);
        });

        testBothModes('safe serializer with null guard', fn => {
            const f = fn(arg<any>(), (b, input) => {
                b.if_(b.isNullish(input), () => {
                    return b.lit(null);
                });
                return b.obj({
                    value: b.get(input, 'value'),
                });
            });
            expect(f(null)).toBe(null);
            expect(f(undefined)).toBe(null);
            expect(f({ value: 42 })).toEqual({ value: 42 });
        });

        testBothModes('range validator', fn => {
            const constraints = [
                { prop: 'min', min: 0 },
                { prop: 'max', max: 100 },
                { prop: 'range', min: 10, max: 50 },
            ];
            const f = fn(arg<any>(), (b, input) => {
                const errors = b.let(b.emptyArr());
                for (const c of constraints) {
                    const value = b.get(input, c.prop);
                    if ((c as any).min !== undefined) {
                        b.if_(b.lt(value, b.lit((c as any).min)), () => {
                            b.push(errors, b.lit(`${c.prop} must be >= ${(c as any).min}`));
                        });
                    }
                    if ((c as any).max !== undefined) {
                        b.if_(b.gt(value, b.lit((c as any).max)), () => {
                            b.push(errors, b.lit(`${c.prop} must be <= ${(c as any).max}`));
                        });
                    }
                }
                return errors;
            });
            expect(f({ min: 5, max: 50, range: 30 })).toEqual([]);
            expect(f({ min: -1, max: 50, range: 30 })).toEqual(['min must be >= 0']);
            expect(f({ min: 5, max: 150, range: 30 })).toEqual(['max must be <= 100']);
            expect(f({ min: 5, max: 50, range: 5 })).toEqual(['range must be >= 10']);
        });

        testBothModes('nested object serializer', fn => {
            interface Address {
                street: string;
                city: string;
            }
            interface User {
                name: string;
                address: Address;
            }

            const serializeAddress = fn(arg<any>(), (b, input) => {
                return b.obj({
                    street: b.get(input, 'street'),
                    city: b.get(input, 'city'),
                });
            });

            const serializeUser = fn(arg<any>(), (b, input) => {
                const address = b.get(input, 'address');
                return b.obj({
                    name: b.get(input, 'name'),
                    address: b.call(serializeAddress, address),
                });
            });

            const user = {
                name: 'John',
                address: { street: '123 Main St', city: 'NYC' },
                extra: 'ignored',
            };
            expect(serializeUser(user)).toEqual({
                name: 'John',
                address: { street: '123 Main St', city: 'NYC' },
            });
        });
    });

    describe('tiered execution', () => {
        const originalThreshold = getJitThreshold();

        afterEach(() => {
            setJitThreshold(originalThreshold);
        });

        test('getJitThreshold returns default value', () => {
            if (process.env.DEEPKIT_JIT_THRESHOLD) {
                expect(getJitThreshold()).toBe(process.env.DEEPKIT_JIT_THRESHOLD === 'Infinity' ? Infinity : parseInt(process.env.DEEPKIT_JIT_THRESHOLD, 10));
            } else {
                expect(getJitThreshold()).toBe(0);
            }
        });

        test('setJitThreshold changes threshold', () => {
            setJitThreshold(5);
            expect(getJitThreshold()).toBe(5);
        });

        test('threshold 0 immediately JIT compiles', () => {
            setJitThreshold(0);
            // Body is called once during tree building
            const f = fn(arg<number>(), (b, n) => n);

            // Calling the function uses the JIT compiled version
            expect(f(1)).toBe(1);
            expect(f(2)).toBe(2);
            expect(f(3)).toBe(3);
        });

        test('tiered execution starts with Exec mode', () => {
            setJitThreshold(5);
            const f = fn(arg<number>(), (b, n) => b.lit(42));

            // First few calls use Exec mode
            expect(f(1)).toBe(42);
            expect(f(2)).toBe(42);
            expect(f(3)).toBe(42);
            expect(f(4)).toBe(42);
        });

        test('switches to JIT after threshold', () => {
            setJitThreshold(3);
            const f = fn(arg<number>(), (b, n) => n);

            // Calls 1-2: Exec mode
            expect(f(1)).toBe(1);
            expect(f(2)).toBe(2);

            // Call 3: Threshold reached, JIT compiles
            expect(f(3)).toBe(3);

            // Calls 4+: JIT mode
            expect(f(4)).toBe(4);
            expect(f(5)).toBe(5);
            expect(f(6)).toBe(6);
        });

        test('JIT compiled function produces correct results', () => {
            setJitThreshold(2);
            const double = (x: number) => x * 2;
            const f = fn(arg<number>(), (b, n) => {
                return b.obj({
                    doubled: b.call(double, n),
                });
            });

            // Exec mode call
            expect(f(5)).toEqual({ doubled: 10 });

            // Triggers JIT compilation
            expect(f(7)).toEqual({ doubled: 14 });

            // JIT mode calls
            expect(f(10)).toEqual({ doubled: 20 });
            expect(f(100)).toEqual({ doubled: 200 });
        });

        test('fnJIT bypasses tiered execution', () => {
            setJitThreshold(100);
            const f = fnJIT(arg<number>(), (b, n) => n);

            // Immediately uses JIT
            expect(f(1)).toBe(1);
            expect(f(2)).toBe(2);
            expect(f(3)).toBe(3);
        });

        test('fnExec always uses Exec mode', () => {
            setJitThreshold(1);
            const f = fnExec(arg<number>(), (b, n) => n);

            // Always uses Exec mode
            expect(f(1)).toBe(1);
            expect(f(2)).toBe(2);
            expect(f(3)).toBe(3);
            expect(f(4)).toBe(4);
            expect(f(5)).toBe(5);
        });
    });

    describe('tree building - single pass', () => {
        test('tree is built once and reused', () => {
            let buildCount = 0;
            setJitThreshold(0);

            // The builder callback is only called once
            const f = fn(arg<number>(), (b, n) => {
                buildCount++;
                return n;
            });

            expect(buildCount).toBe(1);

            // Multiple calls don't rebuild
            f(1);
            f(2);
            f(3);
            expect(buildCount).toBe(1);
        });

        test('tree is shared between Exec and JIT modes', () => {
            let buildCount = 0;
            setJitThreshold(3);

            const f = fn(arg<number>(), (b, n) => {
                buildCount++;
                return n;
            });

            expect(buildCount).toBe(1);

            // Exec mode calls
            f(1);
            f(2);
            expect(buildCount).toBe(1);

            // JIT compilation - still no rebuild
            f(3);
            expect(buildCount).toBe(1);

            // JIT mode calls
            f(4);
            f(5);
            expect(buildCount).toBe(1);
        });
    });

    describe('stress tests and edge cases', () => {
        testBothModes('deeply nested conditionals', fn => {
            const f = fn(arg<number>(), (b, n) => {
                b.if_(
                    b.eq(n, b.lit(1)),
                    () => b.lit('one'),
                    () => {
                        b.if_(
                            b.eq(n, b.lit(2)),
                            () => b.lit('two'),
                            () => {
                                b.if_(
                                    b.eq(n, b.lit(3)),
                                    () => b.lit('three'),
                                    () => {
                                        b.if_(
                                            b.eq(n, b.lit(4)),
                                            () => b.lit('four'),
                                            () => {
                                                b.if_(
                                                    b.eq(n, b.lit(5)),
                                                    () => b.lit('five'),
                                                    () => {
                                                        return b.lit('other');
                                                    },
                                                );
                                            },
                                        );
                                    },
                                );
                            },
                        );
                    },
                );
                return b.lit('unreachable');
            });
            expect(f(1)).toBe('one');
            expect(f(3)).toBe('three');
            expect(f(5)).toBe('five');
            expect(f(99)).toBe('other');
        });

        testBothModes('multiple early returns', fn => {
            const f = fn(arg<number>(), (b, n) => {
                b.if_(b.lt(n, b.lit(0)), () => b.lit('negative'));
                b.if_(b.eq(n, b.lit(0)), () => b.lit('zero'));
                b.if_(b.lt(n, b.lit(10)), () => b.lit('single digit'));
                b.if_(b.lt(n, b.lit(100)), () => b.lit('double digit'));
                return b.lit('large');
            });
            expect(f(-5)).toBe('negative');
            expect(f(0)).toBe('zero');
            expect(f(5)).toBe('single digit');
            expect(f(50)).toBe('double digit');
            expect(f(500)).toBe('large');
        });

        testBothModes('nested loops', fn => {
            const f = fn(arg<number[][]>(), (b, matrix) => {
                const sum = b.var_(0);
                const add = (a: number, c: number) => a + c;
                b.loop(matrix, row => {
                    b.loop(row, cell => {
                        b.setVar(sum, b.call(add, b.getVar(sum), cell));
                    });
                });
                return b.getVar(sum);
            });
            expect(
                f([
                    [1, 2],
                    [3, 4],
                    [5, 6],
                ]),
            ).toBe(21);
            expect(f([[1], [2], [3]])).toBe(6);
            expect(f([[]])).toBe(0);
        });

        testBothModes('early return from nested loop', fn => {
            const f = fn(arg<number[][]>(), (b, matrix) => {
                const result = b.let(b.emptyObj());
                b.loop(matrix, (row, i) => {
                    b.loop(row, (cell, j) => {
                        b.if_(b.eq(cell, b.lit(42)), () => {
                            return b.obj({ found: b.lit(true), row: i, col: j });
                        });
                    });
                });
                b.set(result, 'found', b.lit(false));
                return result;
            });
            expect(
                f([
                    [1, 2],
                    [3, 42],
                    [5, 6],
                ]),
            ).toEqual({ found: true, row: 1, col: 1 });
            expect(
                f([
                    [1, 2],
                    [3, 4],
                ]),
            ).toEqual({ found: false });
        });

        testBothModes('large object creation', fn => {
            const f = fn(arg<any>(), (b, input) => {
                return b.obj({
                    a: input.get('a'),
                    b: input.get('b'),
                    c: input.get('c'),
                    d: input.get('d'),
                    e: input.get('e'),
                    f: input.get('f'),
                    g: input.get('g'),
                    h: input.get('h'),
                    i: input.get('i'),
                    j: input.get('j'),
                });
            });
            const input = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9, j: 10 };
            expect(f(input)).toEqual(input);
        });

        testBothModes('recursive function pattern', fn => {
            // Build inner function
            const double = fn(arg<number>(), (b, n) => {
                return b.call((x: number) => x * 2, n);
            });

            // Use it in outer function
            const f = fn(arg<number[]>(), (b, arr) => {
                return b.map(arr, elem => b.call(double, elem));
            });

            expect(f([1, 2, 3])).toEqual([2, 4, 6]);
        });

        testBothModes('boolean coercion', fn => {
            const f = fn(arg<any>(), (b, input) => {
                const result = b.let(b.emptyArr());
                b.if_(input.get('a'), () => b.push(result, b.lit('a truthy')));
                b.if_(b.not(input.get('b')), () => b.push(result, b.lit('b falsy')));
                return result;
            });
            expect(f({ a: 1, b: 0 })).toEqual(['a truthy', 'b falsy']);
            expect(f({ a: '', b: 'x' })).toEqual([]);
            expect(f({ a: true, b: false })).toEqual(['a truthy', 'b falsy']);
        });

        testBothModes('undefined vs null in equality', fn => {
            const f = fn(arg<any>(), (b, input) => {
                return b.obj({
                    strictNull: b.eq(input.get('val'), b.lit(null)),
                    strictUndef: b.eq(input.get('val'), b.lit(undefined)),
                    isNullish: b.isNullish(input.get('val')),
                });
            });
            expect(f({ val: null })).toEqual({ strictNull: true, strictUndef: false, isNullish: true });
            expect(f({ val: undefined })).toEqual({ strictNull: false, strictUndef: true, isNullish: true });
            expect(f({ val: 0 })).toEqual({ strictNull: false, strictUndef: false, isNullish: false });
        });

        testBothModes('complex type dispatch', fn => {
            const typeOf = (v: any) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

            const f = fn(arg<any>(), (b, input) => {
                const t = b.let(b.call(typeOf, input));
                b.switch_(
                    t,
                    [
                        ['string', () => b.obj({ type: b.lit('string'), len: b.len(input) })],
                        ['number', () => b.obj({ type: b.lit('number'), isInt: b.call(Number.isInteger, input) })],
                        ['boolean', () => b.obj({ type: b.lit('boolean'), val: input })],
                        ['null', () => b.obj({ type: b.lit('null') })],
                        ['array', () => b.obj({ type: b.lit('array'), len: b.len(input) })],
                        ['object', () => b.obj({ type: b.lit('object') })],
                    ],
                    () => b.obj({ type: b.lit('unknown') }),
                );
                return b.lit('unreachable');
            });

            expect(f('hello')).toEqual({ type: 'string', len: 5 });
            expect(f(42)).toEqual({ type: 'number', isInt: true });
            expect(f(3.14)).toEqual({ type: 'number', isInt: false });
            expect(f(true)).toEqual({ type: 'boolean', val: true });
            expect(f(null)).toEqual({ type: 'null' });
            expect(f([1, 2, 3])).toEqual({ type: 'array', len: 3 });
            expect(f({ x: 1 })).toEqual({ type: 'object' });
        });

        testBothModes('variable shadowing in nested scopes', fn => {
            const f = fn(arg<number[]>(), (b, arr) => {
                const result = b.let(b.emptyArr());
                const outer = b.var_(0);
                b.loop(arr, (elem, idx) => {
                    // Different var in inner scope
                    const inner = b.var_(100);
                    b.setVar(
                        inner,
                        b.call((a: number, c: number) => a + c, b.getVar(inner), elem),
                    );
                    b.push(result, b.getVar(inner));
                    // Outer accumulates
                    b.setVar(
                        outer,
                        b.call((a: number, c: number) => a + c, b.getVar(outer), elem),
                    );
                });
                b.push(result, b.getVar(outer));
                return result;
            });
            expect(f([1, 2, 3])).toEqual([101, 102, 103, 6]);
        });

        testBothModes('chained property access with mixed types', fn => {
            const f = fn(arg<any>(), (b, input) => {
                return input.get('users').at(0).get('profile').get('name');
            });
            expect(f({ users: [{ profile: { name: 'Alice' } }] })).toBe('Alice');
        });

        testBothModes('many function arguments', fn => {
            const sum5 = (a: number, c: number, d: number, e: number, _f: number) => a + c + d + e + _f;

            const f = fn(arg<number>(), arg<number>(), arg<number>(), arg<number>(), arg<number>(), (b, a, c, d, e, _f) => {
                return b.call(sum5, a, c, d, e, _f);
            });
            expect(f(1, 2, 3, 4, 5)).toBe(15);
        });

        testBothModes('object keys with special characters', fn => {
            const f = fn(b => {
                return b.obj([
                    ['key with spaces', b.lit(1)],
                    ['key-with-dashes', b.lit(2)],
                    ['key.with.dots', b.lit(3)],
                    ['123numeric', b.lit(4)],
                    ['$dollar', b.lit(5)],
                    ['emoji🎉', b.lit(6)],
                ]);
            });
            expect(f()).toEqual({
                'key with spaces': 1,
                'key-with-dashes': 2,
                'key.with.dots': 3,
                '123numeric': 4,
                $dollar: 5,
                'emoji🎉': 6,
            });
        });

        testBothModes('error in conditional branch', fn => {
            const f = fn(arg<boolean>(), (b, shouldThrow) => {
                b.if_(shouldThrow, () => {
                    b.throw_(b.new_(Error, b.lit('conditional error')));
                });
                return b.lit('success');
            });
            expect(f(false)).toBe('success');
            expect(() => f(true)).toThrow('conditional error');
        });

        testBothModes('deeply nested property access', fn => {
            const f = fn(arg<any>(), (b, input) => {
                return input.get('a').get('b').get('c').get('d').get('e');
            });
            expect(f({ a: { b: { c: { d: { e: 'deep' } } } } })).toBe('deep');
        });

        testBothModes('map returning different types per element', fn => {
            const f = fn(arg<any[]>(), (b, arr) => {
                return b.map(arr, (elem, idx) => {
                    return b.ternary(
                        b.eq(
                            b.call((n: number) => n % 2, idx),
                            b.lit(0),
                        ),
                        elem.get('name'),
                        elem.get('id'),
                    );
                });
            });
            expect(
                f([
                    { id: 1, name: 'Alice' },
                    { id: 2, name: 'Bob' },
                    { id: 3, name: 'Carol' },
                ]),
            ).toEqual(['Alice', 2, 'Carol']);
        });
    });

    describe('while loop', () => {
        testBothModes('basic while loop counts to 5', fn => {
            const f = fn(b => {
                const counter = b.var_(0, 'counter');
                b.while_(b.lt(b.getVar(counter), b.lit(5)), () => {
                    b.setVar(counter, b.add(b.getVar(counter), b.lit(1)));
                });
                return b.getVar(counter);
            });
            expect(f()).toBe(5);
        });

        testBothModes('while loop with break exits early', fn => {
            const f = fn(b => {
                const counter = b.var_(0, 'counter');
                b.while_(b.lit(true), () => {
                    b.setVar(counter, b.add(b.getVar(counter), b.lit(1)));
                    b.if_(b.eq(b.getVar(counter), b.lit(3)), () => {
                        b.break_();
                    });
                });
                return b.getVar(counter);
            });
            expect(f()).toBe(3);
        });

        testBothModes('while loop with continue skips iteration', fn => {
            const f = fn(b => {
                const counter = b.var_(0, 'counter');
                const sum = b.var_(0, 'sum');
                b.while_(b.lt(b.getVar(counter), b.lit(5)), () => {
                    b.setVar(counter, b.add(b.getVar(counter), b.lit(1)));
                    // Skip even numbers
                    b.if_(b.eq(b.mod(b.getVar(counter), b.lit(2)), b.lit(0)), () => {
                        b.continue_();
                    });
                    b.setVar(sum, b.add(b.getVar(sum), b.getVar(counter)));
                });
                return b.getVar(sum); // 1 + 3 + 5 = 9
            });
            expect(f()).toBe(9);
        });

        testBothModes('while loop collects array elements', fn => {
            const f = fn(arg<Uint8Array>(), (b, buffer) => {
                const result = b.let(b.emptyArr());
                const i = b.var_(0, 'i');
                b.while_(b.lt(b.getVar(i), b.len(buffer)), () => {
                    const val = b.at(buffer, b.getVar(i));
                    b.if_(b.eq(val, b.lit(0)), () => {
                        b.break_();
                    });
                    b.push(result, val);
                    b.setVar(i, b.add(b.getVar(i), b.lit(1)));
                });
                return result;
            });
            expect(f(new Uint8Array([1, 2, 3, 0, 5]))).toEqual([1, 2, 3]);
        });

        testBothModes('nested while loops', fn => {
            const f = fn(b => {
                const result = b.let(b.emptyArr());
                const i = b.var_(0, 'i');
                b.while_(b.lt(b.getVar(i), b.lit(3)), () => {
                    const j = b.var_(0, 'j');
                    b.while_(b.lt(b.getVar(j), b.lit(2)), () => {
                        b.push(result, b.add(b.mul(b.getVar(i), b.lit(10)), b.getVar(j)));
                        b.setVar(j, b.add(b.getVar(j), b.lit(1)));
                    });
                    b.setVar(i, b.add(b.getVar(i), b.lit(1)));
                });
                return result;
            });
            expect(f()).toEqual([0, 1, 10, 11, 20, 21]);
        });

        testBothModes('while loop with return inside exits function', fn => {
            const f = fn(arg<number[]>(), (b, arr) => {
                const i = b.var_(0, 'i');
                b.while_(b.lt(b.getVar(i), b.len(arr)), () => {
                    b.if_(b.eq(b.at(arr, b.getVar(i)), b.lit(42)), () => {
                        return b.getVar(i);
                    });
                    b.setVar(i, b.add(b.getVar(i), b.lit(1)));
                });
                return b.lit(-1);
            });
            expect(f([1, 2, 42, 4])).toBe(2);
            expect(f([1, 2, 3])).toBe(-1);
        });
    });
});
