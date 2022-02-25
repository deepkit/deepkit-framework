import { expect, test } from '@jest/globals';
import { EntitySubject, isEntitySubject } from '../src/model';

test('entitySubject', async () => {
    class User {
        id!: string;
    }

    expect(isEntitySubject(new EntitySubject(new User))).toBe(true);
});
