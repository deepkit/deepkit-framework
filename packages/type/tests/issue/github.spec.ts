import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { classToPlain, plainToClass, t, validatedPlainToClass } from '../../index';
import { ClassType } from '@deepkit/core';

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
    };

    const object = plainToClass(TestClass, testData);
    expect(object.fieldC).toBe(undefined);
    expect(object.fieldC).toBe(undefined);

    const plain = classToPlain(TestClass, object);
    expect(plain.fieldC).toBe(undefined);
    expect(plain.fieldD).toBe(undefined);

    expect(JSON.stringify(plain)).toBe(`{"fieldA":"a","fieldB":"b"}`);
});

test('constructor args', () => {
    class Response {
        constructor(@t public success: boolean) {
        }
    }

    class SteamApiResponseClass<T> {
        constructor (public response: T) {}
    }

    function SteamApiResponse<T>(
        responseBodyClass: ClassType<T>,
    ): ClassType<SteamApiResponseClass<T>> {
        class SteamApiResponse extends SteamApiResponseClass<T> {
            // TODO: Check if this type assertion works
            constructor(@t.type(responseBodyClass) response: T) {
                super(response);
            }
        }

        return SteamApiResponse;
    }

    const clazz = SteamApiResponse(Response);
    expect(() => validatedPlainToClass(clazz, { response: { success: 123 } })).toThrow('Validation failed: response.success(required): Required value is undefined');
    expect(() => validatedPlainToClass(clazz, { response: { success: true } })).not.toThrow();

    // class Entity {
    //     constructor(@t.minLength(5) title: string) {
    //     }
    // }

    // validatedPlainToClass(Entity, {title: '1234'});
    // validatedPlainToClass(Entity, {title: '12345'});
});
