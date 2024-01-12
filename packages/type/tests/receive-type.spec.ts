import { expect, test } from '@jest/globals';
import { ReceiveType, resolveReceiveType, typeOf } from '../src/reflection/reflection.js';
import { ReflectionKind, Type } from '../src/reflection/type.js';
import { ReflectionOp } from '@deepkit/type-spec';

test('typeOf', () => {
    const type = typeOf<string>();
    expect(type).toEqual({ kind: ReflectionKind.string });
});

test('custom function', () => {
    function inferTypes<A, B>(a?: ReceiveType<A>, b?: ReceiveType<B>) {
        return [resolveReceiveType(a), resolveReceiveType(b)];
    }

    const types = inferTypes<string, number>();

    expect(types).toEqual([{ kind: ReflectionKind.string }, { kind: ReflectionKind.number }]);
});

test('method call', () => {
    class Database {
        query<T>(type?: ReceiveType<T>) {
            return resolveReceiveType(type);
        }
    }

    const db = new Database();

    const type = db.query<string>();
    expect(type).toEqual({ kind: ReflectionKind.string });
});

test('maintain name', () => {
    interface User {}

    function c<T>(type?: ReceiveType<T>) {
        return resolveReceiveType(type);
    }

    const t = c<User>();
    expect(t.typeName).toBe('User');
});

test('decorator call', () => {
    let got: Type | undefined;

    class HttpDecorator {
        something(): HttpDecorator {
            return this;
        }

        response<T>(name: string, description: string = '', type?: ReceiveType<T>): any {
            got = resolveReceiveType(type);
        }
    }

    const http = new HttpDecorator;

    interface User {
    }

    class Controller {
        @http.something().response<User>('abc')
        action() {
        }
    }

    expect(got).toMatchObject({ kind: ReflectionKind.objectLiteral, typeName: 'User' });
});

test('class constructor', () => {
    class A<T> {
        public type: Type;

        constructor(type?: ReceiveType<T>) {
            this.type = resolveReceiveType(type);
        }
    }

    const aString = new A<string>();
    expect(aString.type).toMatchObject({ kind: ReflectionKind.string });
});

test('class constructor multiple', () => {
    class A<T, A> {
        public type1: Type;
        public type2: Type;

        constructor(type1?: ReceiveType<T>, type2?: ReceiveType<A>) {
            this.type1 = resolveReceiveType(type1);
            this.type2 = resolveReceiveType(type2);
        }
    }

    const aString = new A<string, number>();
    expect(aString.type1).toMatchObject({ kind: ReflectionKind.string });
    expect(aString.type2).toMatchObject({ kind: ReflectionKind.number });
});
