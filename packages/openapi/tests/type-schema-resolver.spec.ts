import { expect, test } from '@jest/globals';

import { MaxLength, Maximum, MinLength, Minimum, typeOf } from '@deepkit/type';

import { unwrapTypeSchema } from '../src/type-schema-resolver';

test('serialize atomic types', () => {
    expect(unwrapTypeSchema(typeOf<string>())).toMatchObject({
        __type: 'schema',
        type: 'string',
    });

    expect(unwrapTypeSchema(typeOf<number & MinLength<5>>())).toMatchObject({
        __type: 'schema',
        type: 'number',
        minLength: 5,
    });

    expect(unwrapTypeSchema(typeOf<number & MaxLength<5>>())).toMatchObject({
        __type: 'schema',
        type: 'number',
        maxLength: 5,
    });

    expect(unwrapTypeSchema(typeOf<number>())).toMatchObject({
        __type: 'schema',
        type: 'number',
    });

    expect(unwrapTypeSchema(typeOf<number & Minimum<5>>())).toMatchObject({
        __type: 'schema',
        type: 'number',
        minimum: 5,
    });

    expect(unwrapTypeSchema(typeOf<number & Maximum<5>>())).toMatchObject({
        __type: 'schema',
        type: 'number',
        maximum: 5,
    });

    expect(unwrapTypeSchema(typeOf<bigint>())).toMatchObject({
        __type: 'schema',
        type: 'number',
    });

    expect(unwrapTypeSchema(typeOf<boolean>())).toMatchObject({
        __type: 'schema',
        type: 'boolean',
    });

    expect(unwrapTypeSchema(typeOf<null>())).toMatchObject({
        __type: 'schema',
        nullable: true,
    });
});

test('serialize enum', () => {
    enum E1 {
        a = 'a',
        b = 'b',
    }

    expect(unwrapTypeSchema(typeOf<E1>())).toMatchObject({
        __type: 'schema',
        type: 'string',
        enum: ['a', 'b'],
        __registryKey: 'E1',
    });

    enum E2 {
        a = 1,
        b = 2,
    }

    expect(unwrapTypeSchema(typeOf<E2>())).toMatchObject({
        __type: 'schema',
        type: 'number',
        enum: [1, 2],
        __registryKey: 'E2',
    });
});

test('serialize union', () => {
    type Union =
        | {
              type: 'push';
              branch: string;
          }
        | {
              type: 'commit';
              diff: string[];
          };

    expect(unwrapTypeSchema(typeOf<Union>())).toMatchObject({
        __type: 'schema',
        oneOf: [
            {
                __type: 'schema',
                type: 'object',
                properties: {
                    type: { __type: 'schema', type: 'string', enum: ['push'] },
                    branch: { __type: 'schema', type: 'string' },
                },
                required: ['type', 'branch'],
            },
            {
                __type: 'schema',
                type: 'object',
                properties: {
                    type: { __type: 'schema', type: 'string', enum: ['commit'] },
                    diff: {
                        __type: 'schema',
                        type: 'array',
                        items: { __type: 'schema', type: 'string' },
                    },
                },
                required: ['type', 'diff'],
            },
        ],
    });

    type EnumLike = 'red' | 'black';

    expect(unwrapTypeSchema(typeOf<EnumLike>())).toMatchObject({
        __type: 'schema',
        type: 'string',
        enum: ['red', 'black'],
        __registryKey: 'EnumLike',
    });
});

test('serialize nullables', () => {
    const t1 = unwrapTypeSchema(typeOf<string>());
    expect(t1).toMatchObject({
        __type: 'schema',
        type: 'string',
    });
    expect(t1.nullable).toBeUndefined();

    const t2 = unwrapTypeSchema(typeOf<string | null>());
    expect(t2).toMatchObject({
        __type: 'schema',
        type: 'string',
        nullable: true,
    });

    interface ITest {
        names: string[];
    }
    const t3 = unwrapTypeSchema(typeOf<ITest>());
    expect(t3).toMatchObject({
        __type: 'schema',
        type: 'object',
    });
    expect(t3.nullable).toBeUndefined();

    const t4 = unwrapTypeSchema(typeOf<ITest | null>());
    expect(t4).toMatchObject({
        __type: 'schema',
        type: 'object',
        nullable: true,
    });

    const t5 = unwrapTypeSchema(typeOf<'a' | 'b' | 'c'>());
    expect(t5).toMatchObject({
        __type: 'schema',
        type: 'string',
        enum: ['a', 'b', 'c'],
    });
    expect(t5.nullable).toBeUndefined();

    const t6 = unwrapTypeSchema(typeOf<'a' | 'b' | 'c' | null>());
    expect(t6).toMatchObject({
        __type: 'schema',
        type: 'string',
        enum: ['a', 'b', 'c'],
        nullable: true,
    });
});
