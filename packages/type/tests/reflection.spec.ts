import { test, expect } from '@jest/globals';
import { typeOf } from '../src/lib/reflection/reflection.js';
import { assertType, ReflectionKind } from '../src/lib/reflection/type.js';

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
