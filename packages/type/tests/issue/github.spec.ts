import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { classToPlain, plainToClass, t } from '../../index';

test('127', () => {
    class TestClass {
        @t.required fieldA!: string;
        @t.required fieldB!: string;
        @t fieldC?: string;
        @t fieldD?: string;
    }

    const testData = {
        fieldA: 'a',
        fieldB: 'b'
    }

    const object = plainToClass(TestClass, testData);
    expect(object.fieldC).toBe(undefined);
    expect(object.fieldC).toBe(undefined);

    const plain = classToPlain(TestClass, object);
    expect(plain.fieldC).toBe(undefined);
    expect(plain.fieldD).toBe(undefined);

    expect(JSON.stringify(plain)).toBe(`{"fieldA":"a","fieldB":"b"}`);
});
