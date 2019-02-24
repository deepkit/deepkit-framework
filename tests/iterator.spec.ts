import 'jest';
import {each, eachKey, eachPair} from "../src/iterators";
import 'jest-extended';

test('test array', () => {
    const array: string[] = ['a', 'b', 'c'];

    for (const v of each(array)) {
        expect(v).toBeString();
    }

    for (let i in array) {
        expect(i).toBeString();
    }

    for (const i of eachKey(array)) {
        expect(i).toBeNumber();
    }

    for (const [k, v] of eachPair(array)) {
        expect(k).toBeNumber();
        expect(v).toBeString();
    }

    for (const [k, v] of eachPair(['y'])) {
        expect(k).toBe(0);
        expect(v).toBe('y');
    }
});



test('test object1', () => {
    const object: {[index: string]: number} = {'a': 1, 'b': 2, 'c': 3};

    for (const v of each(object)) {
        expect(v).toBeNumber();
    }

    for (const i of eachKey(object)) {
        expect(i).toBeString();
    }
});


test('test object2', () => {
    class Mowla {
        z: string;

        constructor(z: string) {
            this.z = z;
        }
    }

    const object2: {[index: string]: Mowla} = {'a': new Mowla('hallo'), 'b': new Mowla('hallo'), 'c': new Mowla('hallo')};

    for (const v of eachKey(object2)) {
        expect(v).toBeString();
    }

    for (const v of each(object2)) {
        expect(v).toBeInstanceOf(Mowla);
    }

    for (const [i, v] of eachPair(object2)) {
        expect(i).toBeString();
        expect(v).toBeInstanceOf(Mowla);
    }
});

test('test object3', () => {
    const object3 = {
        'asd': true,
        'bla': false
    };

    for (const v of eachKey(object3)) {
        expect(v).toBeString();
    }

    for (const v of each(object3)) {
        expect(v).toBeBoolean();
    }

    for (const [k, v] of eachPair(object3)) {
        expect(k).toBeString();
        expect(v).toBeBoolean();
    }
});
