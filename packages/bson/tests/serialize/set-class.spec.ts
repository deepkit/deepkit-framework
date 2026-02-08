import * as bson from 'bson';
import { test } from 'node:test';

import { getBSONSerializer } from '../../index.js';
import { expectBytes } from '../test-utils.js';

const { serialize } = bson;

test('Set serializes as array', () => {
    const serializer = getBSONSerializer<{ tags: Set<string> }>();
    const object = { tags: new Set(['a', 'b', 'c']) };
    expectBytes(serializer(object), serialize({ tags: ['a', 'b', 'c'] }));
});

test('Set with numbers', () => {
    const serializer = getBSONSerializer<{ ids: Set<number> }>();
    const object = { ids: new Set([1, 2, 3]) };
    expectBytes(serializer(object), serialize({ ids: [1, 2, 3] }));
});

class User {
    id: number = 0;
    name: string = '';
}

test('custom class serializes as object', () => {
    const serializer = getBSONSerializer<{ user: User }>();
    const user = new User();
    user.id = 42;
    user.name = 'Alice';
    expectBytes(serializer({ user }), serialize({ user: { id: 42, name: 'Alice' } }));
});

class Point {
    x: number = 0;
    y: number = 0;
}

test('nested custom class', () => {
    const serializer = getBSONSerializer<{ points: Point[] }>();
    const p1 = new Point();
    p1.x = 1;
    p1.y = 2;
    const p2 = new Point();
    p2.x = 3;
    p2.y = 4;
    expectBytes(
        serializer({ points: [p1, p2] }),
        serialize({
            points: [
                { x: 1, y: 2 },
                { x: 3, y: 4 },
            ],
        }),
    );
});
