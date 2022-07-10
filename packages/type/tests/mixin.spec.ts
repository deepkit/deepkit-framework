import { expect, test } from '@jest/globals';
import { mixin } from '../src/mixin';
import { assertType, AutoIncrement, PrimaryKey, ReflectionKind, resolveTypeMembers } from '../src/reflection/type';
import { MinLength } from '../src/validator';
import { reflect, ReflectionClass } from '../src/reflection/reflection';
import { deserialize } from '../src/serializer-facade';

test('mixin base', () => {
    class Timestampable {
        createdAt: Date = new Date;
        updatedAt: Date = new Date;
    }

    class SoftDeleted {
        deletedAt?: Date;
        deletedBy?: string;
    }

    class User extends mixin(Timestampable, SoftDeleted) {
        id: number & PrimaryKey & AutoIncrement = 0;

        constructor(
            public username: string & MinLength<3>
        ) {
            super();
        }
    }

    {
        const user = new User('Peter');
        expect(user.username).toBe('Peter');
        expect(user.createdAt).toBeInstanceOf(Date);
        expect(user).toBeInstanceOf(User);
        expect(user).toBeInstanceOf(Timestampable);
        expect(user).not.toBeInstanceOf(SoftDeleted); //only first entry is the base class
    }

    const type = reflect(User);
    assertType(type, ReflectionKind.class);
    expect(type.types.length).toBe(7); //id, username, constructor , +2 SoftDeleted, +2 Timestampable
    expect(resolveTypeMembers(type).length).toBe(7);

    {
        const user = ReflectionClass.from(User);
        expect(user.getProperty('createdAt').type).toMatchObject({ kind: ReflectionKind.class, classType: Date });
        expect(user.getProperty('updatedAt').type).toMatchObject({ kind: ReflectionKind.class, classType: Date });
        expect(user.getProperty('deletedAt').type).toMatchObject({ kind: ReflectionKind.class, classType: Date });
        expect(user.getProperty('deletedBy').type).toMatchObject({ kind: ReflectionKind.string });
        expect(user.getProperty('username').type).toMatchObject({ kind: ReflectionKind.string });

        {
            const user = deserialize<User>({ username: 'Peter' });
            expect(user).toBeInstanceOf(User);
            expect(user.username).toBe('Peter');
            expect(user.createdAt).toBeInstanceOf(Date);
        }
        {
            const user = deserialize<User>({ username: 'Peter', createdAt: '2022-03-14T21:36:44.793Z' });
            expect(user).toBeInstanceOf(User);
            expect(user.username).toBe('Peter');
            expect(user.createdAt).toBeInstanceOf(Date);
            expect(user.createdAt.toJSON()).toBe('2022-03-14T21:36:44.793Z');
        }
    }
});
