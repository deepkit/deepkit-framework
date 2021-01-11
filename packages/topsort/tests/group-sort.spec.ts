import { expect, test } from '@jest/globals';
import { GroupArraySort } from '../src/group-array-sort';
import { CircularDependencyException, ElementNotFoundException } from '../src/base';
import { bench } from './utils';
import { fail } from 'assert';

function getElementsGroup(count: number) {
    const elements = new Map<{ item: any, type: string }, any[]>();
    for (let i = 0; i < count / 3; i++) {
        elements.set({ item: 'car' + i, type: 'car' }, ['brand' + i]);
        elements.set({ item: 'owner' + i, type: 'owner' }, ['brand' + i, 'car' + i]);
        elements.set({ item: 'brand' + i, type: 'brand' }, []);
    }

    return elements;
}

test('bench', () => {
    const count = 10_000;
    const items = getElementsGroup(count);

    bench(10, `ArraySort Warmup ${count}`, () => {
        const sorter = new GroupArraySort();
        sorter.set(items);
        sorter.sort();
    });

    const sorter = new GroupArraySort();
    sorter.set(items);
    bench(1, `GroupArraySort ${count}`, () => {
        sorter.sort();
    });
});

test('circular disabled', () => {
    const sorter = new GroupArraySort();

    sorter.add('car1', 'car', ['owner1']);
    sorter.add('owner1', 'owner', ['car1']);
    sorter.throwCircularDependency = false;
    sorter.sort();
});

test('circular exception', () => {
    const sorter = new GroupArraySort();

    sorter.add('car1', 'car', ['owner1']);
    sorter.add('owner1', 'owner', ['brand1']);
    sorter.add('brand1', 'brand', ['car1']);

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

test('dependency in same', () => {
    const sorter = new GroupArraySort();
    sorter.add('car1', 'car', ['brand1']);
    sorter.add('car2', 'car', ['car3']);
    sorter.add('car3', 'car', ['brand2']);
    sorter.add('brand1', 'brand');
    sorter.add('brand2', 'brand');

    sorter.sort();
    expect(sorter.getGroups()).toEqual([
        { type: 'brand', items: ['brand1', 'brand2'] },
        { type: 'car', items: ['car1', 'car3', 'car2'] },
    ]);
});

test('dependency in same with activated sameTypeGrouping', () => {
    const sorter = new GroupArraySort();
    sorter.add('car1', 'car', ['brand1']);
    sorter.add('car2', 'car', ['car3']);
    sorter.add('car3', 'car', ['brand2']);
    sorter.add('brand1', 'brand');
    sorter.add('brand2', 'brand');

    sorter.sameTypeExtraGrouping = true;

    sorter.sort();
    expect(sorter.getGroups()).toEqual([
        { type: 'brand', items: ['brand1', 'brand2'] },
        { type: 'car', items: ['car1', 'car3'] },
        { type: 'car', items: ['car2'] },
    ]);
});


test('dependency in same with activated sameTypeGrouping more complex', () => {
    const sorter = new GroupArraySort();
    sorter.add('car6', 'car');
    sorter.add('car1', 'car', ['brand1']);
    sorter.add('car2', 'car', ['car3']);
    sorter.add('car3', 'car', ['brand2']);
    sorter.add('car4', 'car', ['car2']);
    sorter.add('car5', 'car', ['brand2']);
    sorter.add('brand1', 'brand');
    sorter.add('brand2', 'brand');

    sorter.sameTypeExtraGrouping = true;

    sorter.sort();
    expect(sorter.getGroups()).toEqual([
        { type: 'car', items: ['car6'] },
        { type: 'brand', items: ['brand1', 'brand2'] },
        { type: 'car', items: ['car1', 'car3'] },
        { type: 'car', items: ['car2'] },
        { type: 'car', items: ['car4', 'car5'] },
    ]);
});

test('not found', () => {
    const sorter = new GroupArraySort();
    sorter.add('car1', 'car', ['owner1']);
    sorter.add('owner1', 'owner', ['car2']);

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

test('simple2', () => {
    const sorter = new GroupArraySort();
    sorter.add('car1', 'car', ['brand1']);
    sorter.add('brand1', 'brand');
    sorter.add('car2', 'car');
    sorter.add('brand2', 'brand', ['car2']);

    expect(sorter.sort()).toEqual('brand1, car1, car2, brand2'.split(', '));
    expect(sorter.getGroups()).toEqual([
        { type: 'brand', items: ['brand1'] },
        { type: 'car', items: ['car1', 'car2'] },
        { type: 'brand', items: ['brand2'] },
    ]);
});

test('GetGroups', () => {
    const sorter = new GroupArraySort();
    sorter.add('car1', 'car', ['owner1', 'brand1']);
    sorter.add('brand1', 'brand');
    sorter.add('brand2', 'brand');
    sorter.add('owner1', 'user', ['brand1']);
    sorter.add('owner2', 'user', ['brand2']);

    const result = sorter.sort();
    expect(result).toEqual('brand1, brand2, owner1, owner2, car1'.split(', '));

    expect(sorter.groups[0]).toEqual({ type: 'brand', level: 0, position: 0, length: 2 });
    expect(sorter.groups[1]).toEqual({ type: 'user', level: 1, position: 2, length: 2 });
    expect(sorter.groups[2]).toEqual({ type: 'car', level: 2, position: 4, length: 1 });

    expect(sorter.getGroups()).toEqual([
        { type: 'brand', items: ['brand1', 'brand2'] },
        { type: 'user', items: ['owner1', 'owner2'] },
        { type: 'car', items: ['car1'] },
    ]);

    expect(result[sorter.groups[0].position]).toBe('brand1');
    expect(result[sorter.groups[0].position + 1]).toBe('brand2');
    expect(result[sorter.groups[1].position]).toBe('owner1');
    expect(result[sorter.groups[1].position + 1]).toBe('owner2');
    expect(result[sorter.groups[2].position]).toBe('car1');
});

test('SimpleDoc', () => {
    const sorter = new GroupArraySort();
    sorter.add('car1', 'car', ['owner1', 'brand1']);
    sorter.add('brand1', 'brand');
    sorter.add('brand2', 'brand');
    sorter.add('owner1', 'user', ['brand1']);
    sorter.add('owner2', 'user', ['brand2']);

    const result = sorter.sort();
    expect(result).toEqual('brand1, brand2, owner1, owner2, car1'.split(', '));

    expect(sorter.getGroups()).toEqual([
        { type: 'brand', items: ['brand1', 'brand2'] },
        { type: 'user', items: ['owner1', 'owner2'] },
        { type: 'car', items: ['car1'] },
    ]);
});

test('simple', () => {
    const sorter = new GroupArraySort();
    sorter.add('car1', 'car', ['brand1']);
    sorter.add('owner1', 'owner', ['car1', 'brand1']);
    sorter.add('owner2', 'owner', ['car2', 'brand1']);
    sorter.add('car2', 'car', ['brand2']);
    sorter.add('brand1', 'brand');
    sorter.add('brand2', 'brand');

    const result = sorter.sort();

    expect(result).toEqual('brand1, brand2, car1, car2, owner1, owner2'.split(', '));
    expect(sorter.getGroups()).toEqual([
        { type: 'brand', items: ['brand1', 'brand2'] },
        { type: 'car', items: ['car1', 'car2'] },
        { type: 'owner', items: ['owner1', 'owner2'] },
    ]);
});

test('implementation', () => {
    const sorter = new GroupArraySort();
    for (let i = 0; i < 3; i++) {
        sorter.add('car' + i, 'car', ['owner' + i, 'brand' + i]);
        sorter.add('owner' + i, 'owner', ['brand' + i]);
        sorter.add('brand' + i, 'brand');
    }

    const result = sorter.sort();
    expect(result).toEqual('brand0, brand1, brand2, owner0, owner1, owner2, car0, car1, car2'.split(', '));
    expect(sorter.getGroups()).toEqual([
        { type: 'brand', items: ['brand0', 'brand1', 'brand2'] },
        { type: 'owner', items: ['owner0', 'owner1', 'owner2'] },
        { type: 'car', items: ['car0', 'car1', 'car2'] },
    ]);
});

test('implementation2', () => {
    const sorter = new GroupArraySort();
    for (let i = 0; i < 3; i++) {
        sorter.add('brand' + i, 'brand');
        sorter.add('car' + i, 'car', ['owner' + i, 'brand' + i]);
        sorter.add('owner' + i, 'owner', ['brand' + i]);
    }

    const result = sorter.sort();
    expect(result).toEqual('brand0, brand1, brand2, owner0, owner1, owner2, car0, car1, car2'.split(', '));
    expect(sorter.getGroups()).toEqual([
        { type: 'brand', items: ['brand0', 'brand1', 'brand2'] },
        { type: 'owner', items: ['owner0', 'owner1', 'owner2'] },
        { type: 'car', items: ['car0', 'car1', 'car2'] },
    ]);
});

test('implementation3', () => {
    const sorter = new GroupArraySort();
    for (let i = 0; i < 3; i++) {
        sorter.add('brand' + i, 'brand');
        sorter.add('owner' + i, 'owner', ['brand' + i]);
        sorter.add('car' + i, 'car', ['owner' + i, 'brand' + i]);
    }

    const result = sorter.sort();
    expect(result).toEqual('brand0, brand1, brand2, owner0, owner1, owner2, car0, car1, car2'.split(', '));
    expect(sorter.getGroups()).toEqual([
        { type: 'brand', items: ['brand0', 'brand1', 'brand2'] },
        { type: 'owner', items: ['owner0', 'owner1', 'owner2'] },
        { type: 'car', items: ['car0', 'car1', 'car2'] },
    ]);
});

test('implementation4', () => {
    const sorter = new GroupArraySort();
    for (let i = 0; i < 3; i++) {
        sorter.add('owner' + i, 'owner', ['brand' + i]);
        sorter.add('brand' + i, 'brand');
        sorter.add('car' + i, 'car', ['owner' + i, 'brand' + i]);
    }

    const result = sorter.sort();
    expect(result).toEqual('brand0, brand1, brand2, owner0, owner1, owner2, car0, car1, car2'.split(', '));
    expect(sorter.getGroups()).toEqual([
        { type: 'brand', items: ['brand0', 'brand1', 'brand2'] },
        { type: 'owner', items: ['owner0', 'owner1', 'owner2'] },
        { type: 'car', items: ['car0', 'car1', 'car2'] },
    ]);
});
