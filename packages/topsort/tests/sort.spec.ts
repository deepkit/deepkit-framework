import { expect, test } from '@jest/globals';
import { ArraySort } from '../src/array-sort';
import { bench } from './utils';
import { CircularDependencyException, ElementNotFoundException } from '../src/base';
import { fail } from 'assert';

function getElementsFlat(count: number) {
    const elements = new Map<string, string[]>();
    for (let i = 0; i < count / 3; i++) {
        elements.set('car' + i, ['brand' + i]);
        elements.set('owner' + i, ['brand' + i, 'car' + i]);
        elements.set('brand' + i, []);
    }

    return elements;
}

test('bench', () => {
    const count = 10_000;
    const items = getElementsFlat(count);

    bench(100, `Warmup ${count}`, () => {
        const sorter = new ArraySort();
        sorter.set(items);
        sorter.sort();
    });

    const sorter = new ArraySort();
    sorter.set(items);
    bench(1, `ArraySort ${count}`, () => {
        sorter.sort();
    });

});

test('circular disabled', () => {
    const sorter = new ArraySort();

    sorter.add('car1', ['owner1']);
    sorter.add('owner1', ['car1']);
    sorter.throwCircularDependency = false;
    sorter.sort();
});

test('circular exception', () => {
    const sorter = new ArraySort();

    sorter.add('car1', ['owner1']);
    sorter.add('owner1', ['brand1']);
    sorter.add('brand1', ['car1']);

    try {
        sorter.sort();
        fail('this must fail');
    } catch (error) {
        expect(error).toBeInstanceOf(CircularDependencyException);
        if (error instanceof CircularDependencyException) {
            expect(error.nodes).toEqual(['car1', 'owner1', 'brand1']);
            expect(error.getStart()).toBe('car1');
            expect(error.getEnd()).toBe('brand1');
        }
    }
});

test('not found', () => {
    const sorter = new ArraySort();
    sorter.add('car1', ['owner1']);
    sorter.add('owner1', ['car2']);

    try {
        sorter.sort();
        fail('this must fail');
    } catch (error) {
        expect(error).toBeInstanceOf(ElementNotFoundException);
        if (error instanceof ElementNotFoundException) {
            expect(error.element).toBe('owner1');
            expect(error.dependency).toBe('car2');
        }
    }
});


test('blub', () => {
    const sorter = new ArraySort();

    for (let i = 0; i < 2; i++) {
        sorter.add('car' + i, ['owner' + i, 'brand' + i]);
        sorter.add('owner' + i, ['brand' + i]);
        sorter.add('brand' + i);
    }

    sorter.add('sellerX', ['brandX3']);
    sorter.add('brandY', ['sellerX', 'brandX2']);
    sorter.add('brandX');
    sorter.add('brandX2', ['brandX', 'brandX3']);
    sorter.add('brandX3');
    const result = sorter.sort();
    const expected = [
        'brand0',
        'owner0',
        'car0',
        'brand1',
        'owner1',
        'car1',
        'brandX3',
        'sellerX',
        'brandX',
        'brandX2',
        'brandY',
    ];

    expect(result).toEqual(expected);
});
