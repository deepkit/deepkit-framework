import { test, expect } from '@jest/globals';
import { ReflectionClass, typeOf } from '../src/reflection/reflection.js';
import { assertType, Group, ReflectionKind, stringifyType } from '../src/reflection/type.js';

test('union empty interfaces', () => {
    interface Dog {
    }

    interface Cat {
    }

    //If two objectLiterals have the same shape, they are filtered out by flattenUnionTypes + isTypeIncluded.
    //we se type.typeName additional now, so they are not filtered out. If this breaks in the future,
    //we need to find a different way to filter out the same shapes.
    const type = typeOf<Cat | Dog>();
    assertType(type, ReflectionKind.union);
    assertType(type.types[0], ReflectionKind.objectLiteral);
    assertType(type.types[1], ReflectionKind.objectLiteral);
    expect(type.types).toHaveLength(2);
});

test('groups', () => {
    class Model {
        created!: Date & Group<'a'>;
        modified!: Date & Group<'a'> & Group<'b'>;

        field!: (string | number) & Group<'a'>;
        field2!: (string | number) & Group<'a'> & Group<'b'>;
    }

    const schema = ReflectionClass.from(Model);

    expect(schema.getPropertiesInGroup('a').map(v => v.name)).toEqual(['created', 'modified', 'field', 'field2']);
    expect(schema.getPropertiesInGroup('b').map(v => v.name)).toEqual(['modified', 'field2']);

    const created = schema.getProperty('created');
    expect(created.getGroups()).toEqual(['a']);
    expect(created.isInGroup('a')).toBe(true);
    expect(created.isInGroup('b')).toBe(false);
    expect(created.isInGroup('c')).toBe(false);

    const modified = schema.getProperty('modified');
    expect(modified.getGroups()).toEqual(['a', 'b']);
    expect(modified.isInGroup('a')).toBe(true);
    expect(modified.isInGroup('b')).toBe(true);
    expect(modified.isInGroup('c')).toBe(false);

    const field = schema.getProperty('field');
    expect(field.getGroups()).toEqual(['a']);
    expect(field.isInGroup('a')).toBe(true);
    expect(field.isInGroup('b')).toBe(false);
    expect(field.isInGroup('c')).toBe(false);
    expect(stringifyType(field.type)).toBe(`string | number`);

    const field2 = schema.getProperty('field2');
    expect(field2.getGroups()).toEqual(['a', 'b']);
    expect(field2.isInGroup('a')).toBe(true);
    expect(field2.isInGroup('b')).toBe(true);
    expect(field2.isInGroup('c')).toBe(false);
    expect(stringifyType(field2.type)).toBe(`string | number`);
});
