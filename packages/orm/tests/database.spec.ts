import {expect, test} from '@jest/globals';
import {MemoryDatabaseAdapter} from '../src/memory-db';
import {Database} from '../src/database';
import {t, validate, plainToClass} from '@deepkit/type';

test('validation', async () => {
    function MinLength(minLength: number) {
        return (v: string) => {
            if (v.length < minLength) throw new Error(`Min length is ${minLength}`);
        };
    }

    const s = t.schema({
        id: t.number.autoIncrement.primary,
        username: t.string.validator(MinLength(5))
    }, {name: 'User'});

    {
        const item = plainToClass(s, {id: 2, username: '123456'});
        expect(validate(s, item)).toEqual([]);
    }

    {
        const item = plainToClass(s, {id: 2, username: '1234'});
        expect(validate(s, item)).toEqual([{code: 'error', message: 'Min length is 5', path: 'username'}]);
    }

    const database = new Database(new MemoryDatabaseAdapter());

    await database.persist(plainToClass(s, {id: 2, username: '123456'}));

    await expect(() => database.persist(plainToClass(s, {id: 2, username: '123'}))).rejects.toThrow('Validation error for class User:\nusername(error): Min length is 5');
});
