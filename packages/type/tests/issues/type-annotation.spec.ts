import { expect, test } from '@jest/globals';
import { typeOf } from '../../src/reflection/reflection';
import { assertType, MapName, ReflectionKind, typeAnnotation, validationAnnotation } from '../../src/reflection/type';

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
        public firstname: (string | null) & MapName<"first_name"> = null;

        prop: (string & MinLength<1>) | null = null;
    }
    const test = new Test();
    test.firstname = null;
    test.firstname = 'peter';

    // expect(serialize<Test>({ prop: null })).toEqual({ prop: null });
    // expect(serialize<Test>({ prop: '1' })).toEqual({ prop: '1' });
    // expect(cast<Test>({ prop: '1' })).toEqual({ prop: '1' });
    // expect(cast<Test>({ prop: '' })).toEqual({ prop: '' });
});
