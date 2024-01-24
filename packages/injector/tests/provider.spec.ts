import { expect, test } from '@jest/globals';

import {
    ReceiveType,
    ReflectionKind,
    TypeClass,
    TypeObjectLiteral,
    assertType,
    findMember,
    resolveReceiveType,
    typeOf,
} from '@deepkit/type';

import { nominalCompatibility } from '../src/types.js';

/**
 * checks nominal compatibility of two types
 */
function compatible<A, B>(token?: ReceiveType<A>, provider?: ReceiveType<B>): number {
    return nominalCompatibility(
        resolveReceiveType(token),
        resolveReceiveType(provider) as TypeClass | TypeObjectLiteral,
    );
}

test('nominal empty interface', () => {
    interface A {}

    interface B {}

    interface B2 extends B {}

    interface C {
        a: A;
    }

    const a = typeOf<A>();
    const c = typeOf<C>();

    assertType(a, ReflectionKind.objectLiteral);
    assertType(c, ReflectionKind.objectLiteral);
    const propA = findMember('a', c.types);
    assertType(propA, ReflectionKind.propertySignature);
    expect(compatible(propA.type, a)).toBe(1);

    expect(compatible<A, A>()).toBe(1);
    expect(compatible<A, B>()).toBe(0);
    expect(compatible<B, B>()).toBe(1);
    expect(compatible<B, B2>()).toBe(2);
    expect(compatible<B, A>()).toBe(0);
});

test('nominal same interface', () => {
    interface A {
        id: string;
    }

    interface B {
        id: string;
    }

    expect(compatible<A, A>()).toBe(1);
    expect(compatible<A, B>()).toBe(0);
    expect(compatible<B, B>()).toBe(1);
    expect(compatible<B, A>()).toBe(0);
});

test('nominal extends interface', () => {
    interface Base {}
    interface Base2 {}

    interface Connection extends Base {
        id: number;

        write(data: Uint16Array): void;
    }

    class MyConnection1 implements Connection, Base2 {
        id: number = 0;

        write(data: Uint16Array): void {}
    }

    class MyConnection2 {
        id: number = 0;

        write(data: Uint16Array): void {}
    }

    expect(compatible<Connection, MyConnection1>()).toBe(2);
    expect(compatible<Connection, MyConnection2>()).toBe(0);
    expect(compatible<Base, MyConnection1>()).toBe(3);
    expect(compatible<Base2, MyConnection1>()).toBe(2);

    expect(compatible<Base, Connection>()).toBe(2);
    expect(compatible<Base, MyConnection2>()).toBe(0);

    expect(compatible<Base2, Connection>()).toBe(0);
    expect(compatible<Base2, MyConnection2>()).toBe(0);

    expect(compatible<MyConnection1, MyConnection1>()).toBe(1);
    expect(compatible<MyConnection2, MyConnection2>()).toBe(1);

    expect(compatible<MyConnection1, MyConnection2>()).toBe(0);
    expect(compatible<MyConnection2, MyConnection1>()).toBe(0);
});
