import { expect, test } from '@jest/globals';
import { typeOf } from '../../src/reflection/reflection';
import { assertType, findMember, ReflectionKind, stringifyResolvedType } from '../../src/reflection/type';

test('basics', () => {
    class A {
        a = 1;
        b = '2';
        c = true;
        d = 2n;
        e = Symbol('e');
        f = new Date();
        g = new Uint8Array();
    }

    const type = typeOf<A>();
    console.log(stringifyResolvedType(type));

    assertType(type, ReflectionKind.class);
    const a = findMember('a', type.types);
    assertType(a, ReflectionKind.property);
    assertType(a.type, ReflectionKind.number);

    const b = findMember('b', type.types);
    assertType(b, ReflectionKind.property);
    assertType(b.type, ReflectionKind.string);

    const c = findMember('c', type.types);
    assertType(c, ReflectionKind.property);
    assertType(c.type, ReflectionKind.boolean);

    const d = findMember('d', type.types);
    assertType(d, ReflectionKind.property);
    assertType(d.type, ReflectionKind.bigint);

    const e = findMember('e', type.types);
    assertType(e, ReflectionKind.property);
    assertType(e.type, ReflectionKind.symbol);

    const f = findMember('f', type.types);
    assertType(f, ReflectionKind.property);
    assertType(f.type, ReflectionKind.class);
    expect(f.type.classType).toBe(Date);

    const g = findMember('g', type.types);
    assertType(g, ReflectionKind.property);
    assertType(g.type, ReflectionKind.class);
    expect(g.type.classType).toBe(Uint8Array);
});
