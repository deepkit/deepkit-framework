import { expect, test } from '@jest/globals';
import { forwardSetToArray, serializer } from '../src/serializer';
import { deserialize, serialize } from '../src/serializer-facade';
import { validate } from '@deepkit/type';

test('custom iterable', () => {
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

    type T1 = MyIterable<string>;
    type T2 = MyIterable<number>;

    serializer.deserializeRegistry.registerClass(MyIterable, (type, state) => {
        // takes first argument and deserializes as array, just like Set.
        // works because first template argument defined the iterable type.
        // can not be used if the iterable type is not known or not the first template argument.
        forwardSetToArray(type, state);
        // at this point `value` contains the value of `forwardSetToArray`, which is T as array.
        // we forward this value to OrderedSet constructor.
        state.convert(value => {
            return new MyIterable(value);
        });
    });

    serializer.serializeRegistry.registerClass(MyIterable, (type, state) => {
        // Set `MyIterable.items` as current value, so that forwardSetToArray operates on it.
        state.convert((value: MyIterable<unknown>) => value.items);
        // see explanation in deserializeRegistry
        forwardSetToArray(type, state);
    });

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
