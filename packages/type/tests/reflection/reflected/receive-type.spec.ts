import { expect, test } from '@jest/globals';
import { ReceiveType, resolveReceiveType, typeOf } from '../../../src/reflection/reflection';
import { ReflectionKind } from '../../../src/reflection/type';

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
