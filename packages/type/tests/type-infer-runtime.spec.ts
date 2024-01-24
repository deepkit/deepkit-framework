import { expect, test } from '@jest/globals';

import { typeInfer } from '../src/reflection/processor.js';
import { ReflectionClass, typeOf } from '../src/reflection/reflection.js';
import {
    Entity,
    InlineRuntimeType,
    Reference,
    ReflectionKind,
    Type,
    TypeLiteral,
    TypeObjectLiteral,
    TypePropertySignature,
    Unique,
    entityAnnotation,
    float,
    stringifyResolvedType,
    typeDecorators,
    widenLiteral,
} from '../src/reflection/type.js';
import { Maximum, MinLength, validate } from '../src/validator.js';
import { expectEqualType } from './utils.js';

const symbol = Symbol();

test('primitives', () => {
    expectEqualType(typeInfer('asd'), { kind: ReflectionKind.literal, literal: 'asd' } as Type);
    expectEqualType(typeInfer(23), { kind: ReflectionKind.literal, literal: 23 } as Type);
    expectEqualType(typeInfer(true), { kind: ReflectionKind.literal, literal: true } as Type);
    expectEqualType(typeInfer(false), { kind: ReflectionKind.literal, literal: false } as Type);
    expectEqualType(typeInfer(12n), { kind: ReflectionKind.literal, literal: 12n } as Type);
    expectEqualType(typeInfer(symbol), { kind: ReflectionKind.literal, literal: symbol } as Type);
});

test('widen literal', () => {
    expectEqualType(widenLiteral(typeInfer('asd') as TypeLiteral), { kind: ReflectionKind.string }, { noOrigin: true });
    expectEqualType(widenLiteral(typeInfer(23) as TypeLiteral), { kind: ReflectionKind.number }, { noOrigin: true });
    expectEqualType(widenLiteral(typeInfer(true) as TypeLiteral), { kind: ReflectionKind.boolean }, { noOrigin: true });
    expectEqualType(
        widenLiteral(typeInfer(false) as TypeLiteral),
        { kind: ReflectionKind.boolean },
        { noOrigin: true },
    );
    expectEqualType(widenLiteral(typeInfer(12n) as TypeLiteral), { kind: ReflectionKind.bigint }, { noOrigin: true });
    expectEqualType(
        widenLiteral(typeInfer(symbol) as TypeLiteral),
        { kind: ReflectionKind.symbol },
        { noOrigin: true },
    );
});

test('container', () => {
    expectEqualType(typeInfer([123, 'abc', 'bcd']), typeOf<(number | string)[]>() as any, { noOrigin: true });
    expectEqualType(typeInfer(new Set()), typeOf<Set<any>>(), { noOrigin: true });
    expectEqualType(typeInfer(new Map()), typeOf<Map<any, any>>(), { noOrigin: true });
    expectEqualType(typeInfer(new Set(['a', 32])), typeOf<Set<string | number>>() as any, { noOrigin: true });
    expectEqualType(
        typeInfer(
            new Map([
                [1, 'hello'],
                [3, 'yes'],
            ]),
        ),
        typeOf<Map<number, string>>() as any,
        { noOrigin: true },
    );
});

test('class', () => {
    class User {}

    expectEqualType(typeInfer(new User()), typeOf<User>());
    expectEqualType(typeInfer(new Date('')), typeOf<Date>());
});

test('object', () => {
    expectEqualType(typeInfer({ a: 'hello' }), typeOf<{ a: string }>() as any, { noOrigin: true });
    expectEqualType(typeInfer({ a: 123 }), typeOf<{ a: number }>() as any, { noOrigin: true });
    expectEqualType(typeInfer({ a: true }), typeOf<{ a: boolean }>() as any, { noOrigin: true });
    expectEqualType(typeInfer({ a: 12n }), typeOf<{ a: bigint }>() as any, { noOrigin: true });
    expectEqualType(typeInfer({ a: symbol }), typeOf<{ a: symbol }>() as any, { noOrigin: true });
    expectEqualType(typeInfer({ a: new Date() }), typeOf<{ a: Date }>() as any, { noOrigin: true });
    expectEqualType(typeInfer({ a: (b: string): void => undefined }), typeOf<{ a(b: string): void }>() as any, {
        noOrigin: true,
    });
    expectEqualType(
        typeInfer({
            a(b: string): void {},
        }),
        typeOf<{ a(b: string): void }>() as any,
        { noOrigin: true },
    );
});

test('function', () => {
    expectEqualType(
        typeInfer((a: string): void => undefined),
        typeOf<(a: string) => void>() as any,
        { excludes: ['function'] },
    );
    expectEqualType(
        typeInfer((a: string, b: number): void => undefined),
        typeOf<(a: string, b: number) => void>() as any,
        { excludes: ['function'] },
    );
});

test('dynamic type definition for schema definition', () => {
    const schemas = [
        {
            name: 'User',
            tableName: 'users',
            properties: [{ name: 'username', type: 'string', unique: true, minLength: 6 }],
        },
        {
            name: 'Fiction',
            tableName: 'fictions',
            properties: [
                { name: 'title', type: 'string', minLength: 2 },
                { name: 'price', type: 'float', required: true, max: 999 },
                { name: 'author', type: 'reference', refClassName: 'User' },
            ],
        },
    ];

    //first create TypeObjectLiteral, so we can point to them via references
    const types: { [name: string]: TypeObjectLiteral } = {};
    for (const schema of schemas) {
        const type = (types[schema.name] = {
            kind: ReflectionKind.objectLiteral,
            id: 0,
            types: [],
        } as TypeObjectLiteral);
        type.typeName = schema.name;
        //@entity decorator / Entity<> type
        entityAnnotation.registerType(type, { name: schema.name, collection: schema.tableName });
    }

    //now populate all the information we have
    for (const schema of schemas) {
        const type = types[schema.name];
        for (const prop of schema.properties) {
            type.types.push(makeProperty(type, prop));
        }
    }

    for (const [name, schema] of Object.entries(types)) {
        // console.log(stringifyResolvedType(schema));
        // console.log(util.inspect(schema, false, null, true));
    }

    expect(validate({ username: '123' }, types['User'])).toEqual([
        { path: 'username', code: 'minLength', message: 'Min length is 6', value: '123' },
    ]);

    const userReflection = ReflectionClass.from(types['User']);
    expect(entityAnnotation.getFirst(types['User'])?.collection).toBe('users');
    expect(userReflection.getClassName()).toBe('User');
    expect(userReflection.getCollectionName()).toBe('users');

    function makeProperty(
        parent: TypeObjectLiteral,
        prop: {
            name: string;
            type: string;
            minLength?: number;
            max?: number;
            required?: boolean;
            refClassName?: string;
            unique?: boolean;
        },
    ): TypePropertySignature {
        let type: Type = { kind: ReflectionKind.unknown };

        switch (prop.type) {
            case 'string': {
                type = typeOf<string>();
                break;
            }
            case 'float': {
                type = typeOf<float>();
                break;
            }
            case 'reference': {
                if (!prop.refClassName)
                    throw new Error(`Property ${prop.name} is reference but no refClassName defined`);
                const ref: Type = types[prop.refClassName];
                type = { ...typeOf<InlineRuntimeType<typeof ref>>() }; //we want a copy
                break;
            }
            default:
                throw new Error(`Type ${prop.type} not supported`);
        }

        type.decorators = [];
        type.annotations = {};
        if (prop.max) type.decorators.push(typeOf<Maximum<typeof prop.max>>());
        if (prop.minLength) type.decorators.push(typeOf<MinLength<typeof prop.minLength>>());
        if (prop.unique) type.decorators.push(typeOf<Unique>());
        if (prop.refClassName) type.decorators.push(typeOf<Reference>());

        for (const decorator of type.decorators) {
            for (const decoratorHandler of typeDecorators)
                decoratorHandler(type.annotations, decorator as TypeObjectLiteral);
        }

        const property: TypePropertySignature = {
            kind: ReflectionKind.propertySignature,
            name: prop.name,
            type,
            parent,
        };
        if (!prop.required) property.optional = true;

        return property;
    }
});

test('dynamic types validation', () => {
    const type = typeOf<string>();

    type.decorators = [];
    type.annotations = {};
    type.decorators.push(typeOf<MinLength<6>>());

    for (const decorator of type.decorators) {
        for (const decoratorHandler of typeDecorators)
            decoratorHandler(type.annotations, decorator as TypeObjectLiteral);
    }

    expect(validate('asd', type)).toEqual([{ path: '', code: 'minLength', message: 'Min length is 6', value: 'asd' }]);
});
