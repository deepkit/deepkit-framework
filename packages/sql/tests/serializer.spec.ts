import { expect, test } from '@jest/globals';
import { AutoIncrement, deserialize, PrimaryKey, serialize } from '@deepkit/type';
import { sqlSerializer } from '../src/serializer/sql-serializer.js';

test('array', () => {
    class Address {
        name: string = '';
        street: string = '';
        zip: string = '';
    }

    class Person {
        id: number & PrimaryKey & AutoIncrement = 0;
        tags: string[] = [];
        addresses: Address[] = [];
    }

    const runtime = { id: 1, tags: ['a', 'b'], addresses: [{ name: 'a', street: 'b', zip: 'c' }] };
    const res = serialize<Person>(
        runtime,
        undefined, sqlSerializer,
    );
    const record = {
        id: 1,
        tags: JSON.stringify(['a', 'b']),
        addresses: JSON.stringify([{ name: 'a', street: 'b', zip: 'c' }]),
    };
    expect(res).toEqual(record);

    const back = deserialize<Person>(res, undefined, sqlSerializer);
    expect(back).toEqual(runtime);
});


