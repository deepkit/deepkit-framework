import { expect, test } from '@jest/globals';
import { typeOf } from '../../src/reflection/reflection';
import { assertType, MapName, ReflectionKind, typeAnnotation, validationAnnotation } from '../../src/reflection/type';
import { cast, serialize } from '../../src/serializer-facade';

import { TypeAnnotation } from '@deepkit/core';
import { MinLength } from '../../src/validator';

test('Meta', () => {
    type T = string & TypeAnnotation<'foo', { foo: 1, bar: true }>;
    const type = typeOf<T>();
    const meta = typeAnnotation.getOption(type, 'foo');
    console.log(type);
    expect(meta).toEqual({ foo: 1, bar: true });
});

test('standalone', () => {
    type t1 = (string & MinLength<1>) | null;
    const type = typeOf<t1>();
    assertType(type, ReflectionKind.union);
    assertType(type.types[0], ReflectionKind.string);
    assertType(type.types[1], ReflectionKind.null);

    const data = validationAnnotation.getAnnotations(type.types[0]);
    expect(data[0].name).toBe('minLength');

    expect(validationAnnotation.getAnnotations(type.types[1])).toEqual([]);
});

test('on property', () => {
    class Test {
        prop: (string & MinLength<1>) | null = null;
    }

    const clazz = typeOf<Test>();
    assertType(clazz, ReflectionKind.class);
    assertType(clazz.types[0], ReflectionKind.property);

    const type = clazz.types[0].type;

    assertType(type, ReflectionKind.union);
    assertType(type.types[0], ReflectionKind.string);
    assertType(type.types[1], ReflectionKind.null);

    const data = validationAnnotation.getAnnotations(type.types[0]);
    expect(data[0].name).toBe('minLength');

    expect(validationAnnotation.getAnnotations(type.types[1])).toEqual([]);
});

test('property serialization validation', () => {
    class Test {
        public firstname1!: string & MinLength<1>;

        public firstname2: (string | null) & MapName<'first_name2'> = null;

        // note: this MapName does not bubble up to the property and is thus ignored
        public firstname3: (string & MapName<'first_name3'>) | null = null;

        public firstname4: (string & MinLength<1>) | null = null;
    }

    const test = new Test();
    test.firstname1 = 'asd';
    test.firstname2 = 'asd';
    test.firstname3 = 'asd';
    test.firstname4 = 'asd';
    test.firstname2 = null;
    test.firstname3 = null;
    test.firstname4 = null;

    expect(serialize<Test>({ firstname1: 'asd', firstname2: null, firstname3: null, firstname4: null }))
        .toEqual({ firstname1: 'asd', first_name2: null, firstname3: null, firstname4: null });

    expect(cast<Test>({ firstname1: 'asd', first_name2: 'asd', firstname3: 'asd', firstname4: 'asd' }))
        .toEqual({ firstname1: 'asd', firstname2: 'asd', firstname3: 'asd', firstname4: 'asd' });

    expect(() => cast<Test>({ firstname1: '', first_name2: 'asd', firstname3: 'asd', firstname4: '' })).toThrow('firstname1(minLength)');
});
