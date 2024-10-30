import { expect, test } from '@jest/globals';
import { createSerializeFunction, executeTypeArgumentAsArray, SerializeFunction, serializer, TemplateState } from '../src/serializer';
import { deserialize, serialize } from '../src/serializer-facade';
import { validate } from '@deepkit/type';
import { TypeClass } from '../src/reflection/type';

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
 * This example shows how to use `executeTypeArgumentAsArray` to automatically convert a
 * array-like custom type easily.
 */
test('custom iterable', () => {
    type T1 = MyIterable<string>;
    type T2 = MyIterable<number>;

    serializer.deserializeRegistry.registerClass(MyIterable, (type, state) => {
        // takes first argument (0) and deserializes as array.
        executeTypeArgumentAsArray(type, 0, state);
        // at this point current value contains the value of `executeTypeArgumentAsArray`, which is T as array.
        // we forward this value to OrderedSet constructor.
        state.convert(value => {
            return new MyIterable(value);
        });
    });

    serializer.serializeRegistry.registerClass(MyIterable, (type, state) => {
        // set `MyIterable.items` as current value, so that executeTypeArgumentAsArray operates on it.
        state.convert((value: MyIterable<unknown>) => value.items);
        // see explanation in deserializeRegistry
        executeTypeArgumentAsArray(type, 0, state);
    });

    const a = deserialize<T1>(['a', 'b']);
    const b = deserialize<T1>(['a', 2]);
    const c = deserialize<T1>('abc');
    expect(a).toBeInstanceOf(MyIterable);
    expect(a.items).toEqual(['a', 'b']);
    expect(b).toBeInstanceOf(MyIterable);
    expect(b.items).toEqual(['a', '2']);
    expect(c).toBeInstanceOf(MyIterable);
    expect(c.items).toEqual([]);

    const obj1 = new MyIterable<string>();
    obj1.add('a');
    obj1.add('b');

    const json1 = serialize<T1>(obj1);
    console.log(json1);
    expect(json1).toEqual(['a', 'b']);

    const back1 = deserialize<T1>(json1);
    console.log(back1);
    expect(back1).toBeInstanceOf(MyIterable);
    expect(back1.items).toEqual(['a', 'b']);

    const errors = validate<T1>(back1);
    expect(errors).toEqual([]);

    const back2 = deserialize<T2>([1, '2']);
    console.log(back2);
    expect(back2).toBeInstanceOf(MyIterable);
    expect(back2.items).toEqual([1, 2]);
});

/**
 * This example shows how to manually implement a custom iterable using state.convert().
 */
test('custom iterable manual', () => {
    type T1 = MyIterable<string>;
    type T2 = MyIterable<number>;

    function getFirstArgumentSerializer(type: TypeClass, state: TemplateState): SerializeFunction {
        const firstArgument = type.arguments?.[0];
        if (!firstArgument) throw new Error('First type argument in MyIterable is missing');
        return createSerializeFunction(firstArgument, state.registry, state.namingStrategy, state.path);
    }

    serializer.deserializeRegistry.registerClass(MyIterable, (type, state) => {
        const itemSerializer = getFirstArgumentSerializer(type, state);

        state.convert((value: any) => {
            // convert() in `deserializeRegistry` accepts `any`, so we have to check if it's an array.
            // you can choose to throw or silently ignore invalid values,
            // by returning empty `return new MyIterable([]);`
            if (!Array.isArray(value)) throw new Error('Expected array');

            // convert each item in the array to the correct type.
            const items = value.map((v: unknown) => itemSerializer(v));
            return new MyIterable(items);
        });
    });

    serializer.serializeRegistry.registerClass(MyIterable, (type, state) => {
        const itemSerializer = getFirstArgumentSerializer(type, state);

        // convert() in `serializeRegistry` gets the actual runtime type,
        // as anything else would be a TypeScript type error.
        state.convert((value: MyIterable<unknown>) => {
            return value.items.map((v: unknown) => itemSerializer(v));
        });
    });

    expect(deserialize<T1>(['a', 'b'])).toBeInstanceOf(MyIterable);
    expect(deserialize<T1>(['a', 2])).toBeInstanceOf(MyIterable);
    expect(() => deserialize<T1>('abc')).toThrow('Expected array');

    const obj1 = new MyIterable<string>();
    obj1.add('a');
    obj1.add('b');

    const json1 = serialize<T1>(obj1);
    console.log(json1);
    expect(json1).toEqual(['a', 'b']);

    const back1 = deserialize<T1>(json1);
    console.log(back1);
    expect(back1).toBeInstanceOf(MyIterable);
    expect(back1.items).toEqual(['a', 'b']);

    const errors = validate<T1>(back1);
    expect(errors).toEqual([]);

    const back2 = deserialize<T2>([1, '2']);
    console.log(back2);
    expect(back2).toBeInstanceOf(MyIterable);
    expect(back2.items).toEqual([1, 2]);
});
