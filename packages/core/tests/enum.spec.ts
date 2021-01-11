import { expect, test } from '@jest/globals';
import { getEnumLabels, getEnumValues } from '../src/enum';

test('getEnumLabels numbered index', () => {
    enum MyEnum {
        first,
        second,
        third,
    }

    expect(getEnumValues(MyEnum)).toEqual([0, 1, 2]);
    expect(getEnumLabels(MyEnum)).toEqual(['first', 'second', 'third']);
});

test('getEnumLabels custom numbered index', () => {
    enum MyEnum {
        first = 400,
        second = 500,
        third = 600,
    }

    expect(getEnumValues(MyEnum)).toEqual([400, 500, 600]);
    expect(getEnumLabels(MyEnum)).toEqual(['first', 'second', 'third']);
});

test('getEnumLabels partial custom numbered index', () => {
    enum MyEnum {
        first,
        second = 500,
        third,
    }

    expect(getEnumValues(MyEnum)).toEqual([0, 500, 501]);
    expect(getEnumLabels(MyEnum)).toEqual(['first', 'second', 'third']);
});

test('getEnumLabels string index', () => {
    enum MyEnum {
        first = 'my_first',
        second = 'my_second',
        third = 'my_third',
    }

    expect(getEnumValues(MyEnum)).toEqual(['my_first', 'my_second', 'my_third']);
    expect(getEnumLabels(MyEnum)).toEqual(['first', 'second', 'third']);
});

test('getEnumLabels mixed string index', () => {
    enum MyEnum {
        first,
        second = 'my_second',
        third = 'my_third',
    }

    expect(getEnumValues(MyEnum)).toEqual([0, 'my_second', 'my_third']);
    expect(getEnumLabels(MyEnum)).toEqual(['first', 'second', 'third']);
});


test('getEnumLabels string index same name', () => {
    enum MyEnum {
        first = 'first',
        second = 'second',
        third = 'third',
    }

    expect(getEnumValues(MyEnum)).toEqual(['first', 'second', 'third']);
    expect(getEnumLabels(MyEnum)).toEqual(['first', 'second', 'third']);
});
