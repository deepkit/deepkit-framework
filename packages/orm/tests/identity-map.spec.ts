import { expect, test } from '@jest/globals';

import { getClassTypeFromInstance } from '@deepkit/core';
import { PrimaryKey, Reference, ReflectionClass, serializer } from '@deepkit/type';

import { BaseQuery, Formatter, getInstanceStateFromItem, getNormalizedPrimaryKey } from '../index.js';
import { getReference } from '../src/reference.js';

test('getNormalizedPrimaryKey', () => {
    class User {
        id: string & PrimaryKey = '';
        name: string = 'Foo';
    }

    expect(getNormalizedPrimaryKey(ReflectionClass.from(User), '123')).toEqual({ id: '123' });
    expect(getNormalizedPrimaryKey(ReflectionClass.from(User), { id: '124' })).toEqual({ id: '124' });

    class User2 {
        id: string & PrimaryKey = '';
        id2: string & PrimaryKey = '';
        name: string = 'Foo';
    }

    expect(() => getNormalizedPrimaryKey(ReflectionClass.from(User2), '123')).toThrow('Entity User2 has composite primary key');
    expect(getNormalizedPrimaryKey(ReflectionClass.from(User2), { id: '124', id2: '444' })).toEqual({
        id: '124',
        id2: '444',
    });
});

test('original schema', () => {
    class User {
        id!: number & PrimaryKey;

        constructor(public username: string) {}
    }

    const ref = getReference(ReflectionClass.from(User), { id: 2 });
    expect(ref.id).toBe(2);

    expect(ReflectionClass.from(getClassTypeFromInstance(ref)) === ReflectionClass.from(User)).toBe(true);
});

test('snapshot correct state', () => {
    class Image {
        id!: number & PrimaryKey;
    }

    class User {
        id!: number & PrimaryKey;
        username!: string;
        image?: Image & Reference;
        image2?: Image & Reference;
    }

    const formatter = new Formatter(ReflectionClass.from(User), serializer);

    {
        const query = new BaseQuery(ReflectionClass.from(User));
        const user1 = formatter.hydrate(query.model, { username: 'Peter', id: '2', image: '1' });
        const snapshot = getInstanceStateFromItem(user1).getSnapshot();
        expect(snapshot.hasOwnProperty('image2')).toBe(true);
        //when schema changes we get from mongodb `undefined` for new fields, but our snapshot converts that to `null`
        // since all databases use `null` as `not defined`. this means we basically ignore `undefined` where possible.
        expect(snapshot).toEqual({ username: 'Peter', id: 2, image: { id: 1 }, image2: null });

        user1.image2 = getReference(ReflectionClass.from(Image), { id: 2 });
        expect(user1.image2.id).toBe(2);
        getInstanceStateFromItem(user1).markAsPersisted();
        expect(getInstanceStateFromItem(user1).getSnapshot()).toEqual({
            username: 'Peter',
            id: 2,
            image: { id: 1 },
            image2: { id: 2 },
        });

        user1.image = undefined;
        getInstanceStateFromItem(user1).markAsPersisted();
        expect(getInstanceStateFromItem(user1).getSnapshot()).toEqual({
            username: 'Peter',
            id: 2,
            image: null,
            image2: { id: 2 },
        });
    }

    {
        const query = new BaseQuery(ReflectionClass.from(User));
        const user1 = formatter.hydrate(query.model, { username: 'Peter2', id: '3', image: '1', image2: null });
        const snapshot = getInstanceStateFromItem(user1).getSnapshot();
        expect(snapshot.hasOwnProperty('image2')).toBe(true);
        expect(snapshot).toEqual({ username: 'Peter2', id: 3, image: { id: 1 }, image2: null });

        user1.image2 = getReference(ReflectionClass.from(Image), { id: 2 });
        expect(user1.image2.id).toBe(2);
        getInstanceStateFromItem(user1).markAsPersisted();
        expect(getInstanceStateFromItem(user1).getSnapshot()).toEqual({
            username: 'Peter2',
            id: 3,
            image: { id: 1 },
            image2: { id: 2 },
        });
    }
});
