import { expect, test } from '@jest/globals';
import { each, eachKey, eachPair } from '../src/iterators';

test('test array', () => {
    const array: string[] = ['a', 'b', 'c'];

    for (const v of each(array)) {
        expect(typeof v).toBe('string');
    }

    for (let i in array) {
        expect(typeof i).toBe('string');
    }

    for (const i of eachKey(array)) {
        expect(typeof i).toBe('number');
    }

    for (const [k, v] of eachPair(array)) {
        expect(typeof k).toBe('number');
        expect(typeof v).toBe('string');
    }

    for (const [k, v] of eachPair(['y'])) {
        expect(k).toBe(0);
        expect(v).toBe('y');
    }
});



test('test object1', () => {
    const object: { [index: string]: number } = { 'a': 1, 'b': 2, 'c': 3 };

    for (const v of each(object)) {
        expect(typeof v).toBe('number');
    }

    for (const i of eachKey(object)) {
        expect(typeof i).toBe('string');
    }
});


test('test object2', () => {
    class Mowla {
        z: string;

        constructor(z: string) {
            this.z = z;
        }
    }

    const object2: { [index: string]: Mowla } = { 'a': new Mowla('hallo'), 'b': new Mowla('hallo'), 'c': new Mowla('hallo') };

    for (const v of eachKey(object2)) {
        expect(typeof v).toBe('string');
    }

    for (const v of each(object2)) {
        expect(v).toBeInstanceOf(Mowla);
    }

    for (const [i, v] of eachPair(object2)) {
        expect(typeof i).toBe('string');
        expect(v).toBeInstanceOf(Mowla);
    }
});

test('test object3', () => {
    const object3 = {
        'asd': true,
        'bla': false
    };

    for (const v of eachKey(object3)) {
        expect(typeof v).toBe('string');
    }

    for (const v of each(object3)) {
        expect(typeof v).toBe('boolean');
    }

    for (const [k, v] of eachPair(object3)) {
        expect(typeof k).toBe('string');
        expect(typeof v).toBe('boolean');
    }
});
