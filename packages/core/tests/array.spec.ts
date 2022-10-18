import { expect, test } from '@jest/globals';
import { arrayMoveItem } from '../src/array.js';
import { arrayClear, arrayHasItem, arrayRemoveItem } from '@deepkit/core';


test('clear', () => {
    const array = ['a', 'b', 'c'];
    expect(arrayClear(array)).toBe(3);
    expect(array.length).toBe(0);
});


test('remove', () => {

    const array = ['a', 'b', 'c'];
    expect(arrayRemoveItem(array, 'c')).toBe(true);
    expect(array).toEqual(['a', 'b']);

    expect(arrayRemoveItem(array, 'a')).toBe(true);
    expect(array).toEqual(['b']);

    expect(arrayRemoveItem(array, 'b')).toBe(true);
    expect(array).toEqual([]);

    expect(arrayRemoveItem(array, 'd')).toBe(false);
    expect(array).toEqual([]);
});

test('has', () => {
    const array = ['a', 'b', 'c'];
    expect(arrayHasItem(array, 'a')).toBe(true);
    expect(arrayHasItem(array, 'b')).toBe(true);
    expect(arrayHasItem(array, 'c')).toBe(true);
    expect(arrayHasItem(array, 'd')).toBe(false);
});

test('move', () => {
    expect(arrayMoveItem(['a', 'b', 'c'], 'a', +1)).toEqual(['b', 'a', 'c']);
    expect(arrayMoveItem(['a', 'b', 'c'], 'a', +2)).toEqual(['b', 'c', 'a']);
    expect(arrayMoveItem(['a', 'b', 'c'], 'a', +3)).toEqual(['b', 'c', 'a']);
    expect(arrayMoveItem(['a', 'b', 'c'], 'a', +4)).toEqual(['b', 'c', 'a']);

    expect(arrayMoveItem(['a', 'b', 'c'], 'a', 0)).toEqual(['a', 'b', 'c']);
    expect(arrayMoveItem(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c']);
    expect(arrayMoveItem(['a', 'b', 'c'], 'a', -2)).toEqual(['a', 'b', 'c']);
    expect(arrayMoveItem(['a', 'b', 'c'], 'a', -3)).toEqual(['a', 'b', 'c']);


    expect(arrayMoveItem(['a', 'b', 'c'], 'b', -2)).toEqual(['b', 'a', 'c']);
    expect(arrayMoveItem(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(arrayMoveItem(['a', 'b', 'c'], 'b', +1)).toEqual(['a', 'c', 'b']);
    expect(arrayMoveItem(['a', 'b', 'c'], 'b', +2)).toEqual(['a', 'c', 'b']);
    expect(arrayMoveItem(['a', 'b', 'c'], 'b', +3)).toEqual(['a', 'c', 'b']);


    expect(arrayMoveItem(['a', 'b', 'c'], 'c', -3)).toEqual(['c', 'a', 'b']);
    expect(arrayMoveItem(['a', 'b', 'c'], 'c', -2)).toEqual(['c', 'a', 'b']);
    expect(arrayMoveItem(['a', 'b', 'c'], 'c', -1)).toEqual(['a', 'c', 'b']);
    expect(arrayMoveItem(['a', 'b', 'c'], 'c', +1)).toEqual(['a', 'b', 'c']);
    expect(arrayMoveItem(['a', 'b', 'c'], 'c', +2)).toEqual(['a', 'b', 'c']);
});
