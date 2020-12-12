import {expect, test} from '@jest/globals';
import {
    asyncOperation,
    getClassName,
    getObjectKeysSize,
    getPathValue,
    isArray,
    isClass,
    isFunction,
    isObject,
    isPlainObject,
    isPromise,
    isUndefined,
    setPathValue,
    sleep
} from '../src/core';

class SimpleClass {
    constructor(public name: string){}
}

test('helper getClassName', () => {
    class User {
        constructor(public readonly name: string) {}
    }

    class MyError extends Error {}

    expect(getClassName(new User('peter'))).toBe('User');
    expect(getClassName(User)).toBe('User');

    expect(getClassName(MyError)).toBe('MyError');
    expect(getClassName(new MyError)).toBe('MyError');
});

test('helper isObject', () => {
    expect(isObject([])).toBe(false);
    expect(isObject(false)).toBe(false);
    expect(isObject(true)).toBe(false);
    expect(isObject(null)).toBe(false);
    expect(isObject(undefined)).toBe(false);
    expect(isObject(() => {})).toBe(false);
    expect(isObject(function() {})).toBe(false);
    expect(isObject(1)).toBe(false);
    expect(isObject('1')).toBe(false);

    expect(isObject({})).toBe(true);
    expect(isObject(new Date())).toBe(true);
    expect(isObject(new SimpleClass('asd'))).toBe(true);
});

test('helper isPromise', async () => {
    expect(isPromise([])).toBe(false);
    expect(isPromise(false)).toBe(false);
    expect(isPromise(true)).toBe(false);
    expect(isPromise(null)).toBe(false);
    expect(isPromise(undefined)).toBe(false);
    expect(isPromise(() => {})).toBe(false);
    expect(isPromise(function() {})).toBe(false);
    expect(isPromise(1)).toBe(false);
    expect(isPromise('1')).toBe(false);

    function foo1() {
    }

    const foo2 = () => {};
    expect(isPromise(foo1())).toBe(false);
    expect(isPromise(foo2())).toBe(false);

    async function foo3() {
    }
    function foo4() {
        return new Promise((resolve) => {
            resolve(1);
        })
    }

    expect(isObject(foo3())).toBe(true);
    expect(isObject(foo4())).toBe(true);
    expect(isObject(await foo4())).toBe(false);
    expect(isObject((async () => {})())).toBe(true);
});

test('helper isFunction', () => {
    expect(isFunction([])).toBe(false);
    expect(isFunction(false)).toBe(false);
    expect(isFunction(true)).toBe(false);
    expect(isFunction(null)).toBe(false);
    expect(isFunction(undefined)).toBe(false);
    expect(isFunction(1)).toBe(false);
    expect(isFunction('1')).toBe(false);
    expect(isFunction({})).toBe(false);
    expect(isFunction(new Date())).toBe(false);
    expect(isFunction(new SimpleClass('asd'))).toBe(false);

    expect(isFunction(isFunction)).toBe(true);
    expect(isFunction(() => {})).toBe(true);
    expect(isFunction(async () => {})).toBe(true);
    expect(isFunction(function() {})).toBe(true);
    expect(isFunction(async function() {})).toBe(true);
});

test('helper isClass', () => {
    expect(isClass([])).toBe(false);
    expect(isClass(false)).toBe(false);
    expect(isClass(true)).toBe(false);
    expect(isClass(null)).toBe(false);
    expect(isClass(undefined)).toBe(false);
    expect(isClass(1)).toBe(false);
    expect(isClass('1')).toBe(false);
    expect(isClass({})).toBe(false);
    expect(isClass(new Date())).toBe(false);
    expect(isClass(new SimpleClass('asd'))).toBe(false);
    expect(isClass(isFunction)).toBe(false);
    expect(isClass(() => {})).toBe(false);
    expect(isClass(async () => {})).toBe(false);
    expect(isClass(function() {})).toBe(false);
    expect(isClass(async function() {})).toBe(false);

    expect(isClass(SimpleClass)).toBe(true);
});

test('helper isPlainObject', () => {
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject(false)).toBe(false);
    expect(isPlainObject(true)).toBe(false);
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject(undefined)).toBe(false);
    expect(isPlainObject(1)).toBe(false);
    expect(isPlainObject('1')).toBe(false);
    expect(isPlainObject(() => {})).toBe(false);
    expect(isPlainObject(function() {})).toBe(false);

    expect(isPlainObject(new Date())).toBe(false);
    expect(isPlainObject(new SimpleClass('asd'))).toBe(false);

    class O extends Object {
    }
    expect(isPlainObject(new O)).toBe(false);

    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject(new Object)).toBe(true);
});

test('helper is array', () => {
    expect(isArray({})).toBe(false);
    expect(isArray(new Date())).toBe(false);
    expect(isArray(new SimpleClass('asd'))).toBe(false);
    expect(isArray(false)).toBe(false);
    expect(isArray(true)).toBe(false);
    expect(isArray(null)).toBe(false);
    expect(isArray(undefined)).toBe(false);
    expect(isArray(1)).toBe(false);
    expect(isArray('1')).toBe(false);

    expect(isArray([])).toBe(true);
});

test('helper is isUndefined', () => {
    expect(isUndefined({})).toBe(false);
    expect(isUndefined(new Date())).toBe(false);
    expect(isUndefined(new SimpleClass('asd'))).toBe(false);
    expect(isUndefined(false)).toBe(false);
    expect(isUndefined(true)).toBe(false);
    expect(isUndefined(null)).toBe(false);
    expect(isUndefined(1)).toBe(false);
    expect(isUndefined('1')).toBe(false);
    expect(isUndefined([])).toBe(false);

    expect(isUndefined(undefined)).toBe(true);
});

test('test getPathValue', () => {
    expect(getPathValue({
        bla: 3
    }, 'bla')).toBe(3);

    expect(getPathValue({
        bla: 3
    }, 'bla2', null)).toBe(null);

    expect(getPathValue({
    }, 'bla', 'another')).toBe('another');

});

test('test getPathValue deep', () => {
    expect(getPathValue({
        bla: {
            mowla: 5
        }
    }, 'bla.mowla')).toBe(5);

    expect(getPathValue({
        'bla.mowla': 5
    }, 'bla.mowla')).toBe(5);

    expect(getPathValue({
        bla: {
            mowla: {
                evenDeeper: true
            }
        }
    }, 'bla.mowla.evenDeeper')).toBe(true);

    expect(getPathValue({
        bla: {
            mowla: {
                evenDeeper: true
            }
        }
    }, 'bla.mowla')['evenDeeper']).toBe(true);
});

test('test setPathValue ', () => {
    {
        const obj: any = {};
        setPathValue(obj, 'bla2', 5);
        expect(obj['bla2']).toBe(5);
    }

    {
        const obj: any = {};
        setPathValue(obj, 'bla.mowla', 6);
        expect(obj['bla']['mowla']).toBe(6);
    }
});


test('asyncOperation', async () => {
    let fetched = false;
    try {
        await asyncOperation(async (resolve) => {
            await sleep(0.2);
            throw new Error('MyError1');
        });
    } catch (error) {
        fetched = true;
        expect(error.stack).toContain('MyError1');
        expect(error.stack).toContain('asyncOperation');
    }
    expect(fetched).toBe(true);
});

test('asyncOperation deep', async () => {
    let fetched = false;
    try {
        await asyncOperation(async (resolve) => {
            await sleep(0.2);
            await asyncOperation(async (resolve) => {
                await sleep(0.2);
                throw new Error('MyError2');
            })
        });
    } catch (error) {
        fetched = true;
        expect(error.stack).toContain('MyError2');
        expect(error.stack).toContain('asyncOperation');
    }
    expect(fetched).toBe(true);
});


test('getObjectKeysSize', async () => {
    expect(getObjectKeysSize({})).toBe(0);
    expect(getObjectKeysSize({a: true})).toBe(1);
    expect(getObjectKeysSize({a: 1, b: 1, c: 3, d: 4, e: {}})).toBe(5);
});
