import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { getClassSchema, jsonSerializer, t } from '@deepkit/type';
import { BaseQuery, Formatter, getInstanceStateFromItem, getNormalizedPrimaryKey } from '../index';
import { getReference } from '../src/reference';

test('getNormalizedPrimaryKey', () => {
    class User {
        @t.primary id: string = '';
        @t name: string = 'Foo';
    }

    expect(getNormalizedPrimaryKey(getClassSchema(User), '123')).toEqual({ id: '123' });
    expect(getNormalizedPrimaryKey(getClassSchema(User), { id: '124' })).toEqual({ id: '124' });

    class User2 {
        @t.primary id: string = '';
        @t.primary id2: string = '';
        @t name: string = 'Foo';
    }

    expect(() => getNormalizedPrimaryKey(getClassSchema(User2), '123')).toThrow('Entity User2 has composite primary key');
    expect(getNormalizedPrimaryKey(getClassSchema(User2), { id: '124', id2: '444' })).toEqual({ id: '124', id2: '444' });
});

test('original schema', () => {
    class User {
        @t.primary id!: number;

        constructor(@t public username: string) {
        }
    }

    const ref = getReference(getClassSchema(User), { id: 2 });
    expect(ref.id).toBe(2);

    expect(getClassSchema(ref) === getClassSchema(User)).toBe(true);
});

test('snapshot correct state', () => {
    const image = t.schema({
        id: t.number.primary
    });

    const user = t.schema({
        id: t.number.primary,
        username: t.string,
        image: t.type(image).optional.reference(),
        image2: t.type(image).optional.reference(),
    });
    const formatter = new Formatter(user, jsonSerializer);

    {
        const query = new BaseQuery(user);
        const user1 = formatter.hydrate(query.model, { username: 'Peter', id: '2', image: '1' });
        const snapshot = getInstanceStateFromItem(user1).getSnapshot();
        expect(snapshot.hasOwnProperty('image2')).toBe(true);
        //when schema changes we get from mongodb `undefined` for new fields, but our snapshot converts that to `null`
        // since all databases use `null` as `not defined`. this means we basically ignore `undefined` where possible.
        expect(snapshot).toEqual({ username: 'Peter', id: 2, image: { id: 1 }, image2: null });

        user1.image2 = getReference(image, { id: 2 });
        expect(user1.image2.id).toBe(2);
        getInstanceStateFromItem(user1).markAsPersisted();
        expect(getInstanceStateFromItem(user1).getSnapshot()).toEqual({ username: 'Peter', id: 2, image: { id: 1 }, image2: { id: 2 } });

        user1.image = undefined;
        getInstanceStateFromItem(user1).markAsPersisted();
        expect(getInstanceStateFromItem(user1).getSnapshot()).toEqual({ username: 'Peter', id: 2, image: null, image2: { id: 2 } });
    }

    {
        const query = new BaseQuery(user);
        const user1 = formatter.hydrate(query.model, { username: 'Peter2', id: '3', image: '1', image2: null });
        const snapshot = getInstanceStateFromItem(user1).getSnapshot();
        expect(snapshot.hasOwnProperty('image2')).toBe(true);
        expect(snapshot).toEqual({ username: 'Peter2', id: 3, image: { id: 1 }, image2: null });

        user1.image2 = getReference(image, { id: 2 });
        expect(user1.image2.id).toBe(2);
        getInstanceStateFromItem(user1).markAsPersisted();
        expect(getInstanceStateFromItem(user1).getSnapshot()).toEqual({ username: 'Peter2', id: 3, image: { id: 1 }, image2: { id: 2 } });
    }
});
