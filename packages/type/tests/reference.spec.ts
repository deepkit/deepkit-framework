import { expect, test } from '@jest/globals';
import { createReferenceClass } from '../src/reference';
import { getClassSchema } from '../src/model';
import { getClassName } from '@deepkit/core';
import { t } from '../src/decorators';

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