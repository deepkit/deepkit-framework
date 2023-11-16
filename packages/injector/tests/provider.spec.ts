import { expect, test } from '@jest/globals';
import { assertType, findMember, ReceiveType, ReflectionKind, resolveReceiveType, TypeClass, TypeObjectLiteral, typeOf } from '@deepkit/type';
import { nominalCompatibility } from '../src/types.js';

/**
 * checks nominal compatibility of two types
 */
function compatible<A, B>(token?: ReceiveType<A>, provider?: ReceiveType<B>): boolean {
    return nominalCompatibility(resolveReceiveType(token), resolveReceiveType(provider) as TypeClass | TypeObjectLiteral);
}

test('nominal empty interface', () => {
    interface A {
    }

    interface B {
    }

    interface C {
        a: A;
    }

    const a = typeOf<A>();
    const c = typeOf<C>();

    assertType(a, ReflectionKind.objectLiteral);
    assertType(c, ReflectionKind.objectLiteral);
    const propA = findMember('a', c.types);
    assertType(propA, ReflectionKind.propertySignature);
    expect(compatible(propA.type, a)).toBe(true);

    expect(compatible<A, A>()).toBe(true);
    expect(compatible<A, B>()).toBe(false);
    expect(compatible<B, B>()).toBe(true);
    expect(compatible<B, A>()).toBe(false);
});

test('nominal same interface', () => {
    interface A {
        id: string;
    }

    interface B {
        id: string;
    }

    expect(compatible<A, A>()).toBe(true);
    expect(compatible<A, B>()).toBe(false);
    expect(compatible<B, B>()).toBe(true);
    expect(compatible<B, A>()).toBe(false);
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

        write(data: Uint16Array): void {
        }
    }

    class MyConnection2 {
        id: number = 0;

        write(data: Uint16Array): void {
        }
    }

    expect(compatible<Connection, MyConnection1>()).toBe(true);
    expect(compatible<Connection, MyConnection2>()).toBe(false);
    expect(compatible<Base, MyConnection1>()).toBe(true);
    expect(compatible<Base2, MyConnection1>()).toBe(true);

    expect(compatible<Base, Connection>()).toBe(true);
    expect(compatible<Base, MyConnection2>()).toBe(false);

    expect(compatible<Base2, Connection>()).toBe(false);
    expect(compatible<Base2, MyConnection2>()).toBe(false);

    expect(compatible<MyConnection1, MyConnection1>()).toBe(true);
    expect(compatible<MyConnection2, MyConnection2>()).toBe(true);

    expect(compatible<MyConnection1, MyConnection2>()).toBe(false);
    expect(compatible<MyConnection2, MyConnection1>()).toBe(false);
});
