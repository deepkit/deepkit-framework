import { expect, test } from '@jest/globals';
import {
    asyncOperation,
    changeClass,
    collectForMicrotask,
    getClassName,
    getClassTypeFromInstance,
    getObjectKeysSize,
    getPathValue,
    isArray,
    isClass,
    isClassInstance,
    isConstructable,
    isFunction,
    isObject,
    isPlainObject,
    isPromise,
    isPrototypeOfBase,
    isUndefined,
    setPathValue,
    sleep,
    stringifyValueWithType
} from '../src/core';

class SimpleClass {
    constructor(public name: string) { }
}

test('helper getClassName', () => {
    class User {
        constructor(public readonly name: string) { }
    }

    class MyError extends Error { }

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
    expect(isObject(() => { })).toBe(false);
    expect(isObject(function () { })).toBe(false);
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
    expect(isPromise(() => { })).toBe(false);
    expect(isPromise(function () { })).toBe(false);
    expect(isPromise(1)).toBe(false);
    expect(isPromise('1')).toBe(false);

    function foo1() {
    }

    const foo2 = () => { };
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
    expect(isObject((async () => { })())).toBe(true);
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
    expect(isFunction(() => { })).toBe(true);
    expect(isFunction(async () => { })).toBe(true);
    expect(isFunction(function () { })).toBe(true);
    expect(isFunction(async function () { })).toBe(true);
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
    expect(isClass(() => { })).toBe(false);
    expect(isClass(async () => { })).toBe(false);
    expect(isClass(function () { })).toBe(false);
    expect(isClass(async function () { })).toBe(false);

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
    expect(isPlainObject(() => { })).toBe(false);
    expect(isPlainObject(function () { })).toBe(false);

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
    class MyError extends Error { }

    let fetched = false;
    try {
        async function doIt() {
            await asyncOperation(async (resolve) => {
                await sleep(0.2);
                throw new MyError('MyError1');
            });
        }
        await doIt();
    } catch (error) {
        fetched = true;
        expect(error).toBeInstanceOf(MyError);
        expect(error.stack).toContain('MyError1');
        expect(error.stack).toContain('doIt');
    }
    expect(fetched).toBe(true);
});

test('asyncOperation deep', async () => {
    let fetched = false;
    try {
        async function doIt1() {
            await asyncOperation(async (resolve) => {
                await sleep(0.2);
                async function doIt2() {
                    await asyncOperation(async (resolve) => {
                        await sleep(0.2);
                        throw new Error('MyError2');
                    })
                };
                await doIt2();
            });
        }
        await doIt1();
    } catch (error) {
        fetched = true;
        expect(error.stack).toContain('MyError2');
        expect(error.stack).toContain('doIt1');
        expect(error.stack).toContain('doIt2');
    }
    expect(fetched).toBe(true);
});


test('getObjectKeysSize', async () => {
    expect(getObjectKeysSize({})).toBe(0);
    expect(getObjectKeysSize({ a: true })).toBe(1);
    expect(getObjectKeysSize({ a: 1, b: 1, c: 3, d: 4, e: {} })).toBe(5);
});


test('isPrototypeOfBase', () => {
    class Base { }

    class Child1 extends Base { }
    class Child2 extends Base { }

    class Child1_1 extends Child1 { }
    class Child1_1_1 extends Child1_1 { }

    expect(isPrototypeOfBase(Base, Base)).toBe(true);
    expect(isPrototypeOfBase(Child1, Base)).toBe(true);
    expect(isPrototypeOfBase(Child2, Base)).toBe(true);
    expect(isPrototypeOfBase(Child1_1, Base)).toBe(true);
    expect(isPrototypeOfBase(Child1_1, Child1)).toBe(true);
    expect(isPrototypeOfBase(Child1_1_1, Base)).toBe(true);
    expect(isPrototypeOfBase(Child1_1_1, Child1_1)).toBe(true);
});

test('isConstructable', () => {
    expect(isConstructable(class { })).toBe(true)
    expect(isConstructable(class { }.bind(undefined))).toBe(true)
    expect(isConstructable(function () { })).toBe(true)
    expect(isConstructable(function () { }.bind(undefined))).toBe(true)
    expect(isConstructable(() => { })).toBe(false)
    expect(isConstructable((() => { }).bind(undefined))).toBe(false)
    expect(isConstructable(async () => { })).toBe(false)
    expect(isConstructable(async function () { })).toBe(false)
    expect(isConstructable(function* () { })).toBe(false)
    expect(isConstructable({ foo() { } }.foo)).toBe(false)
    expect(isConstructable(URL)).toBe(true)
});

test('collectForMicrotask', async () => {
    let got: string[] = [];
    const collected = (strings: string[]) => {
        got.length = 0;
        got.push(...strings);
    };
    const fn = collectForMicrotask(collected);

    fn('a');
    fn('b');
    fn('c');

    await sleep(0.1);
    expect(got).toEqual(['a', 'b', 'c']);
    fn('d');

    await sleep(0.1);
    expect(got).toEqual(['d']);
});

test('stringifyValueWithType', async () => {
    class Peter {id = 1}
    expect(stringifyValueWithType(new Peter)).toBe(`Peter {id: Number(1)}`);
    expect(stringifyValueWithType({id: 1})).toBe(`Object {id: Number(1)}`);
    expect(stringifyValueWithType('foo')).toBe(`String(foo)`);
    expect(stringifyValueWithType(2)).toBe(`Number(2)`);
    expect(stringifyValueWithType(true)).toBe(`Boolean(true)`);
    expect(stringifyValueWithType(function Peter() {})).toBe(`Function Peter`);
});

test('getClassTypeFromInstance', async () => {
    class Peter {}
    expect(getClassTypeFromInstance(new Peter)).toBe(Peter);
    expect(() => getClassTypeFromInstance({})).toThrow('Value is not a class instance');
    expect(() => getClassTypeFromInstance('asd')).toThrow('Value is not a class instance');
    expect(() => getClassTypeFromInstance(23)).toThrow('Value is not a class instance');
    expect(() => getClassTypeFromInstance(undefined)).toThrow('Value is not a class instance');
});

test('isClassInstance', async () => {
    class Peter {}
    expect(isClassInstance(new Peter)).toBe(true);
    expect(isClassInstance({})).toBe(false);
    expect(isClassInstance('asd')).toBe(false);
    expect(isClassInstance(undefined)).toBe(false);
    expect(isClassInstance(null)).toBe(false);
    expect(isClassInstance(3223)).toBe(false);
});

test('isClassInstance', async () => {
    class Model1 {
        id: number = 0;
    }

    class Base {}
    
    class Model2 extends Base {
        id: number = 0;

        model2() {
            return true;
        }
    }

    const model1 = new Model1;
    model1.id = 22;

    changeClass(model1, Model2);
    expect(model1 instanceof Model1).toBe(true);

    expect(changeClass(model1, Model2) instanceof Model2).toBe(true);
    expect(changeClass(model1, Model2) instanceof Base).toBe(true);
    expect(changeClass(model1, Model2) instanceof Model1).toBe(false);
    expect(changeClass(model1, Model2).model2()).toBe(true);
});
