import { expect, test } from '@jest/globals';
import { pathResolver } from '../../../src/path';
import { ReflectionKind } from '../../../src/reflection/type';

test('pathResolver object literal', () => {
    type t = { a: string, b: number };

    const resolver = pathResolver<t>();

    expect(resolver('a')).toMatchObject({ kind: ReflectionKind.propertySignature, type: { kind: ReflectionKind.string } });
    expect(resolver('b')).toMatchObject({ kind: ReflectionKind.propertySignature, type: { kind: ReflectionKind.number } });
    expect(resolver('c')).toEqual(undefined);
});

test('pathResolver array', () => {
    type t = { a: string[], b: number[][] };

    const resolver = pathResolver<t>();

    expect(resolver('a')).toMatchObject({ kind: ReflectionKind.propertySignature, type: { kind: ReflectionKind.array } });
    expect(resolver('a.0')).toMatchObject({ kind: ReflectionKind.string });

    expect(resolver('b')).toMatchObject({ kind: ReflectionKind.propertySignature, type: { kind: ReflectionKind.array } });
    expect(resolver('b.0')).toMatchObject({ kind: ReflectionKind.array });
    expect(resolver('b.0.0')).toMatchObject({ kind: ReflectionKind.number });
});

test('pathResolver deep ', () => {
    type t = { a: string, b: { c: boolean } };

    const resolver = pathResolver<t>();

    expect(resolver('a')).toMatchObject({ kind: ReflectionKind.propertySignature, type: { kind: ReflectionKind.string } });

    expect(resolver('b')).toMatchObject({ kind: ReflectionKind.propertySignature, type: { kind: ReflectionKind.objectLiteral } });
    expect(resolver('b.c')).toMatchObject({ kind: ReflectionKind.propertySignature, type: { kind: ReflectionKind.boolean } });
});

test('pathResolver deep array object', () => {
    type t = { a: string[], b: { c: boolean }[][] };

    const resolver = pathResolver<t>();

    expect(resolver('a')).toMatchObject({ kind: ReflectionKind.propertySignature, type: { kind: ReflectionKind.array } });
    expect(resolver('a.0')).toMatchObject({ kind: ReflectionKind.string });

    expect(resolver('b')).toMatchObject({ kind: ReflectionKind.propertySignature, type: { kind: ReflectionKind.array } });
    expect(resolver('b.0')).toMatchObject({ kind: ReflectionKind.array });
    expect(resolver('b.0.0')).toMatchObject({ kind: ReflectionKind.objectLiteral });
    expect(resolver('b.0.0.c')).toMatchObject({ kind: ReflectionKind.propertySignature, type: { kind: ReflectionKind.boolean } });
});

test('pathResolver deep class', () => {
    interface Config {
        name: string;
        value: any;
    }

    class User {
        id: number = 0;

        settings: Config[] = [];

        constructor(public username: string) {
        }
    }

    type t = { a: string[], b: User };

    const resolver = pathResolver<t>();

    expect(resolver('a')).toMatchObject({ kind: ReflectionKind.propertySignature, type: { kind: ReflectionKind.array } });
    expect(resolver('b')).toMatchObject({ kind: ReflectionKind.propertySignature, type: { kind: ReflectionKind.class, classType: User } });
    expect(resolver('b.username')).toMatchObject({ kind: ReflectionKind.property, type: { kind: ReflectionKind.string } });
    expect(resolver('b.id')).toMatchObject({ kind: ReflectionKind.property, type: { kind: ReflectionKind.number } });
    expect(resolver('b.settings.0.name')).toMatchObject({ kind: ReflectionKind.propertySignature, type: { kind: ReflectionKind.string } });
    expect(resolver('b.settings.0.value')).toMatchObject({ kind: ReflectionKind.propertySignature, type: { kind: ReflectionKind.any } });
    expect(resolver('b.settings.1.name')).toMatchObject({ kind: ReflectionKind.propertySignature, type: { kind: ReflectionKind.string } });
    expect(resolver('b.settings.1.value')).toMatchObject({ kind: ReflectionKind.propertySignature, type: { kind: ReflectionKind.any } });
});
