import 'reflect-metadata';
import { expect, test } from '@jest/globals';
import { createReference, createReferenceClass, getReferenceInfo, isReferenceHydrated, markAsHydrated } from '../src/reference';
import { getClassSchema } from '../src/model';
import { getClassName } from '@deepkit/core';
import { t } from '../src/decorators';
import { plainToClass } from '../src/json-serializer';

test('reference', () => {
    class Image {
    }

    class User {
        @t id: number = 0;

        @t.reference().optional profileImage?: Image;
    }

    const referenceClass = createReferenceClass(getClassSchema(User));

    {
        const reference = new referenceClass();
        expect(getClassName(reference)).toBe('UserReference');
        expect(() => reference.profileImage).toThrow('Reference User.profileImage was not loaded');
    }
});

test('plainToClass reference', () => {
    class B {
        @t.primary id: number = 0;

        constructor(
            @t public title: string
        ) {
        }
    }


    class A {
        @t.primary id: number = 0;
        @t.reference() b: B = new B('');
    }

    {
        const c = plainToClass(A, { id: 1, b: 2 });
        expect(c.b).toBeInstanceOf(B);
        expect(c.b.id).toBe(2);
    }

    {
        const c = plainToClass(A, { id: 1, b: createReference(B, { id: 2 }) });
        expect(c.b).toBeInstanceOf(B);
        expect(c.b.id).toBe(2);
    }
});


test('hydrated', () => {
    class User {
        @t.primary id: number = 0;
    }

    const user1 = createReference(User, { id: 1 });
    const user2 = createReference(User, { id: 2 });
    const user3 = createReference(User, { id: 3 });

    expect(isReferenceHydrated(user1)).toBe(false);
    expect(isReferenceHydrated(user2)).toBe(false);
    expect(isReferenceHydrated(user3)).toBe(false);

    const info = getReferenceInfo(user1);
    markAsHydrated(user1);

    expect(isReferenceHydrated(user1)).toBe(true);
    expect(isReferenceHydrated(user2)).toBe(false);
    expect(isReferenceHydrated(user3)).toBe(false);
});
