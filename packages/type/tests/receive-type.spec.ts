import { expect, test } from '@jest/globals';
import { ReceiveType, resolveReceiveType, typeOf } from '../src/reflection/reflection.js';
import { ReflectionKind, Type } from '../src/reflection/type.js';

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

    interface User {}

    class Controller {
        @http.something().response<User>('abc')
        action() {}
    }

    expect(got).toMatchObject({kind: ReflectionKind.objectLiteral, typeName: 'User'});
});
