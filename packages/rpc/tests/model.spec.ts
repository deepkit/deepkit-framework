import { test } from 'node:test';
import { expect } from '@deepkit/run/expect';

import { EntitySubject, isEntitySubject } from '../src/model.js';

test('entitySubject', async () => {
    class User {
        id!: string;
    }

    expect(isEntitySubject(new EntitySubject(new User()))).toBe(true);
});
