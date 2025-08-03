/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

/** @group Array */

export function arrayHasItem<T>(array: T[], item: T): boolean {
    return -1 !== array.indexOf(item);
}

/**
 * Clears the array so its empty. Returns the amount of removed items.
 */
export function arrayClear<T>(array: T[]): number {
    const found = array.length;
    array.length = 0;
    return found;
}

/**
 * Removes on particular item by reference of an array.
 */
export function arrayRemoveItem<T>(array: T[], item: T): boolean {
    const index = array.indexOf(item);
    if (-1 !== index) {
        array.splice(index, 1);
        return true;
    }

    return false;
}

/**
 * Moves a particular item in an array up or down (move>0=down, move<0=up).
 * Changes the array itself.
 *
 * ```typescript
 * const array = ['a', 'b', 'c'];
 *
 * arrayMoveItem(array, 'a', +1); //['b', 'a', 'c']
 * arrayMoveItem(array, 'a', -1); //['a', 'b', 'c']
 *
 * arrayMoveItem(array, 'b', -1); //['b', 'a', 'c']
 * arrayMoveItem(array, 'b', +1); //['a', 'c', 'b']
 *
 * arrayMoveItem(array, 'c', -1); //['b', 'c', 'b']
 * arrayMoveItem(array, 'c', +1); //['a', 'b', 'c']
 *
 * ```
 */
export function arrayMoveItem<A extends T[], T>(array: A, item: T, move: number): A {
    if (move === 0) return array;
    const index = array.indexOf(item);
    if (-1 !== index) {
        const newIndex = index + move;
        array.splice(index, 1);

        if (newIndex <= 0) {
            array.unshift(item);
        } else if (newIndex >= array.length) {
            array.push(item);
        } else {
            array.splice(newIndex, 0, item);
        }
    }
    return array;
}
