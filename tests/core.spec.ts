import 'jest-extended'
import {isArray, isObject, isPlainObject, isUndefined} from "../src";

class SimpleClass {
    constructor(public name: string){}
}

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
