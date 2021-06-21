import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { EntitySubject, isEntitySubject } from '../src/model';
import { Collection, isCollection } from '../src/collection';


test('collection', async () => {
    class User {
        id!: string;
    }

    expect(isCollection(new Collection(User))).toBe(true);
});

test('entitySubject', async () => {
    class User {
        id!: string;
    }

    expect(isEntitySubject(new EntitySubject(new User))).toBe(true);
});
