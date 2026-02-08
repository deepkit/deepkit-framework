import { test } from 'node:test';

import { expect } from '@deepkit/run/expect';

import { Serializer, TypeClass, TypeHandler, registerDefaultHandlers, registerTypeGuards, registerUnionHandler, validate } from '../index.js';
import { typeOf } from '../src/reflection/reflection';

class MyIterable<T> implements Iterable<T> {
    items: T[] = [];

    constructor(items: T[] = []) {
        this.items = items;
    }

    [Symbol.iterator](): Iterator<T> {
        return this.items[Symbol.iterator]();
    }

    add(item: T) {
        this.items.push(item);
    }
}

/**
 * This example shows how to use the new TypeHandler API to automatically convert a
 * array-like custom type.
 */
test('custom iterable', () => {
    type T1 = MyIterable<string>;
    type T2 = MyIterable<number>;

    // Create a fresh serializer instance to avoid caching issues
    const customSerializer = new Serializer('json');
    registerDefaultHandlers(customSerializer);
    registerTypeGuards(customSerializer);
    registerUnionHandler(customSerializer);

    const deserializeIterable: TypeHandler<TypeClass> = (type, input, b, state) => {
        const elementType = type.arguments?.[0];
        if (!elementType) {
            // No type argument - return empty
            return b.call((v: any) => new MyIterable([]), input);
        }

        // Check if input is array, if not return empty
        // Use b.if_ for lazy evaluation (only executed when condition is true)
        const isArray = b.call(Array.isArray, input);
        const result = b.var_<MyIterable<any>>(undefined as any);
        b.if_(
            isArray,
            () => {
                const mapped = b.map(input, elem => state.build(elementType, elem));
                b.setVar(
                    result,
                    b.call((items: any[]) => new MyIterable(items), mapped),
                );
            },
            () => {
                b.setVar(
                    result,
                    b.call(() => new MyIterable([]), input),
                );
            },
        );
        return b.getVar(result);
    };

    const serializeIterable: TypeHandler<TypeClass> = (type, input, b, state) => {
        const elementType = type.arguments?.[0];
        if (!elementType) {
            return b.emptyArr();
        }

        // Get items from MyIterable and serialize each
        const items = input.get('items');
        return b.map(items, elem => state.build(elementType, elem));
    };

    customSerializer.deserializeRegistry.registerClass(MyIterable, deserializeIterable);
    customSerializer.serializeRegistry.registerClass(MyIterable, serializeIterable);

    // Use the custom serializer's methods directly
    const deserializeT1 = customSerializer.buildDeserializer<T1>(typeOf<T1>());
    const serializeT1 = customSerializer.buildSerializer<T1>(typeOf<T1>());
    const deserializeT2 = customSerializer.buildDeserializer<T2>(typeOf<T2>());

    const a = deserializeT1(['a', 'b']);
    const b = deserializeT1(['a', 2]);
    const c = deserializeT1('abc');
    expect(a).toBeInstanceOf(MyIterable);
    expect(a.items).toEqual(['a', 'b']);
    expect(b).toBeInstanceOf(MyIterable);
    expect(b.items).toEqual(['a', '2']);
    expect(c).toBeInstanceOf(MyIterable);
    expect(c.items).toEqual([]);

    const obj1 = new MyIterable<string>();
    obj1.add('a');
    obj1.add('b');

    const json1 = serializeT1(obj1);
    expect(json1).toEqual(['a', 'b']);

    const back1 = deserializeT1(json1);
    expect(back1).toBeInstanceOf(MyIterable);
    expect(back1.items).toEqual(['a', 'b']);

    const errors = validate<T1>(back1);
    expect(errors).toEqual([]);

    const back2 = deserializeT2([1, '2']);
    expect(back2).toBeInstanceOf(MyIterable);
    expect(back2.items).toEqual([1, 2]);
});

/**
 * This example shows how to manually implement a custom iterable using the new TypeHandler API.
 */
test('custom iterable manual', () => {
    type T1 = MyIterable<string>;
    type T2 = MyIterable<number>;

    // Create a fresh serializer instance
    const customSerializer = new Serializer('json');
    registerDefaultHandlers(customSerializer);
    registerTypeGuards(customSerializer);
    registerUnionHandler(customSerializer);

    const deserializeIterable: TypeHandler<TypeClass> = (type, input, b, state) => {
        const elementType = type.arguments?.[0];
        if (!elementType) throw new Error('First type argument in MyIterable is missing');

        // For manual approach, we do the validation ourselves
        // Use b.if_ for lazy evaluation
        const isArray = b.call(Array.isArray, input);
        const result = b.var_<MyIterable<any>>(undefined as any);
        b.if_(
            isArray,
            () => {
                const mapped = b.map(input, elem => state.build(elementType, elem));
                b.setVar(
                    result,
                    b.call((items: any[]) => new MyIterable(items), mapped),
                );
            },
            () => {
                // b.exec() forces evaluation for side effects (like throwing)
                b.exec(
                    b.call(() => {
                        throw new Error('Expected array');
                    }, input),
                );
            },
        );
        return b.getVar(result);
    };

    const serializeIterable: TypeHandler<TypeClass> = (type, input, b, state) => {
        const elementType = type.arguments?.[0];
        if (!elementType) throw new Error('First type argument in MyIterable is missing');

        // Get items and serialize each
        const items = input.get('items');
        return b.map(items, elem => state.build(elementType, elem));
    };

    customSerializer.deserializeRegistry.registerClass(MyIterable, deserializeIterable);
    customSerializer.serializeRegistry.registerClass(MyIterable, serializeIterable);

    // Use the custom serializer's methods directly
    const deserializeT1 = customSerializer.buildDeserializer<T1>(typeOf<T1>());
    const serializeT1 = customSerializer.buildSerializer<T1>(typeOf<T1>());
    const deserializeT2 = customSerializer.buildDeserializer<T2>(typeOf<T2>());

    expect(deserializeT1(['a', 'b'])).toBeInstanceOf(MyIterable);
    expect(deserializeT1(['a', 2])).toBeInstanceOf(MyIterable);
    expect(() => deserializeT1('abc')).toThrow('Expected array');

    const obj1 = new MyIterable<string>();
    obj1.add('a');
    obj1.add('b');

    const json1 = serializeT1(obj1);
    expect(json1).toEqual(['a', 'b']);

    const back1 = deserializeT1(json1);
    expect(back1).toBeInstanceOf(MyIterable);
    expect(back1.items).toEqual(['a', 'b']);

    const errors = validate<T1>(back1);
    expect(errors).toEqual([]);

    const back2 = deserializeT2([1, '2']);
    expect(back2).toBeInstanceOf(MyIterable);
    expect(back2.items).toEqual([1, 2]);
});
