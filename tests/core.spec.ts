import 'jest-extended'
import {
    asyncOperation,
    getClassName,
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
} from "../src/core";

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
    expect(isObject([])).toBeFalse();
    expect(isObject(false)).toBeFalse();
    expect(isObject(true)).toBeFalse();
    expect(isObject(null)).toBeFalse();
    expect(isObject(undefined)).toBeFalse();
    expect(isObject(1)).toBeFalse();
    expect(isObject('1')).toBeFalse();

    expect(isObject({})).toBeTrue();
    expect(isObject(new Date())).toBeTrue();
    expect(isObject(new SimpleClass('asd'))).toBeTrue();
});

test('helper isPromise', async () => {
    expect(isPromise([])).toBeFalse();
    expect(isPromise(false)).toBeFalse();
    expect(isPromise(true)).toBeFalse();
    expect(isPromise(null)).toBeFalse();
    expect(isPromise(undefined)).toBeFalse();
    expect(isPromise(1)).toBeFalse();
    expect(isPromise('1')).toBeFalse();

    function foo1() {
    }

    const foo2 = () => {};
    expect(isPromise(foo1())).toBeFalse();
    expect(isPromise(foo2())).toBeFalse();

    async function foo3() {
    }
    function foo4() {
        return new Promise((resolve) => {
            resolve(1);
        })
    }

    expect(isObject(foo3())).toBeTrue();
    expect(isObject(foo4())).toBeTrue();
    expect(isObject(await foo4())).toBeFalse();
    expect(isObject((async () => {})())).toBeTrue();
});

test('helper isFunction', () => {
    expect(isFunction([])).toBeFalse();
    expect(isFunction(false)).toBeFalse();
    expect(isFunction(true)).toBeFalse();
    expect(isFunction(null)).toBeFalse();
    expect(isFunction(undefined)).toBeFalse();
    expect(isFunction(1)).toBeFalse();
    expect(isFunction('1')).toBeFalse();
    expect(isFunction({})).toBeFalse();
    expect(isFunction(new Date())).toBeFalse();
    expect(isFunction(new SimpleClass('asd'))).toBeFalse();

    expect(isFunction(isFunction)).toBeTrue();
    expect(isFunction(() => {})).toBeTrue();
    expect(isFunction(async () => {})).toBeTrue();
    expect(isFunction(function() {})).toBeTrue();
    expect(isFunction(async function() {})).toBeTrue();
});

test('helper isClass', () => {
    expect(isClass([])).toBeFalse();
    expect(isClass(false)).toBeFalse();
    expect(isClass(true)).toBeFalse();
    expect(isClass(null)).toBeFalse();
    expect(isClass(undefined)).toBeFalse();
    expect(isClass(1)).toBeFalse();
    expect(isClass('1')).toBeFalse();
    expect(isClass({})).toBeFalse();
    expect(isClass(new Date())).toBeFalse();
    expect(isClass(new SimpleClass('asd'))).toBeFalse();
    expect(isClass(isFunction)).toBeFalse();
    expect(isClass(() => {})).toBeFalse();
    expect(isClass(async () => {})).toBeFalse();
    expect(isClass(function() {})).toBeFalse();
    expect(isClass(async function() {})).toBeFalse();

    expect(isClass(SimpleClass)).toBeTrue();
});

test('helper isPlainObject', () => {
    expect(isPlainObject([])).toBeFalse();
    expect(isPlainObject(false)).toBeFalse();
    expect(isPlainObject(true)).toBeFalse();
    expect(isPlainObject(null)).toBeFalse();
    expect(isPlainObject(undefined)).toBeFalse();
    expect(isPlainObject(1)).toBeFalse();
    expect(isPlainObject('1')).toBeFalse();

    expect(isPlainObject(new Date())).toBeFalse();
    expect(isPlainObject(new SimpleClass('asd'))).toBeFalse();

    class O extends Object {
    }
    expect(isPlainObject(new O)).toBeFalse();

    expect(isPlainObject({})).toBeTrue();
    expect(isPlainObject(new Object)).toBeTrue();
});

test('helper is array', () => {
    expect(isArray({})).toBeFalse();
    expect(isArray(new Date())).toBeFalse();
    expect(isArray(new SimpleClass('asd'))).toBeFalse();
    expect(isArray(false)).toBeFalse();
    expect(isArray(true)).toBeFalse();
    expect(isArray(null)).toBeFalse();
    expect(isArray(undefined)).toBeFalse();
    expect(isArray(1)).toBeFalse();
    expect(isArray('1')).toBeFalse();

    expect(isArray([])).toBeTrue();
});

test('helper is isUndefined', () => {
    expect(isUndefined({})).toBeFalse();
    expect(isUndefined(new Date())).toBeFalse();
    expect(isUndefined(new SimpleClass('asd'))).toBeFalse();
    expect(isUndefined(false)).toBeFalse();
    expect(isUndefined(true)).toBeFalse();
    expect(isUndefined(null)).toBeFalse();
    expect(isUndefined(1)).toBeFalse();
    expect(isUndefined('1')).toBeFalse();
    expect(isUndefined([])).toBeFalse();

    expect(isUndefined(undefined)).toBeTrue();
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
        expect(error.stack).toContain('Object.asyncOperation');
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
        console.log(error);
        expect(error.stack).toContain('MyError2');
        expect(error.stack).toContain('Object.asyncOperation');
    }
    expect(fetched).toBe(true);
});
