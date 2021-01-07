import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { jsonTypeGuards } from '../src/json-typeguards';
import { getClassSchema, getSortedUnionTypes, jsonSerializer, PropertySchema, t, validate } from '../index';

class ConfigA {
    @t.literal('a').discriminant
    kind: 'a' = 'a';

    @t
    myValue: string = '';
}

class ConfigB {
    @t.literal('b').discriminant
    kind: 'b' = 'b';

    @t
    myValue2: string = '';
}

class User {
    @t.union(ConfigA, ConfigB)
    config: ConfigA | ConfigB = new ConfigA;
}

class UserWithConfigArray {
    @t.array(t.union(ConfigA, ConfigB))
    configs: (ConfigA | ConfigB)[] = [];
}

class UserWithConfigMap {
    @t.map(t.union(ConfigA, ConfigB))
    configs: { [name: string]: (ConfigA | ConfigB) } = {};
}

test('test discriminator schema', () => {
    const schema = getClassSchema(User);
    const config = schema.getProperty('config');
    expect(config.type).toBe('union');
    expect(config.templateArgs.map(v => v.resolveClassType)).toEqual([ConfigA, ConfigB]);

    expect(getClassSchema(ConfigB).getProperty('myValue2').templateArgs).toEqual([]);
    expect(getClassSchema(ConfigB).getProperty('myValue2').isResolvedClassTypeIsDecorated()).toEqual(false);

    const schemaConfigA = getClassSchema(ConfigA);
    expect(schemaConfigA.getProperty('kind').type).toBe('literal');
    expect(schemaConfigA.getProperty('kind').isDiscriminant).toBe(true);
    expect(schemaConfigA.getProperty('myValue').isDiscriminant).toBe(false);
    expect(schemaConfigA.getProperty('myValue').isArray).toBe(false);
    expect(schemaConfigA.getProperty('myValue').type).toBe('string');

    {
        const b = getClassSchema(ConfigB);
        expect(b.discriminant).toBe('kind');
        const clone = b.clone();
        expect(clone.discriminant).toBe(b.discriminant);
        expect(b.getProperty('kind').isDiscriminant).toBe(true);
        expect(b.getProperty('kind').type).toBe('literal');
        expect(clone.getProperty('kind').isDiscriminant).toBe(true);
        expect(clone.getProperty('kind').type).toBe('literal');
    }

    {
        const config = schema.getProperty('config');
        getSortedUnionTypes(config, jsonTypeGuards);

        const a = getClassSchema(ConfigA);
        const b = getClassSchema(ConfigB);
        const u1 = t.union(a, b).buildPropertySchema();
        expect(u1.templateArgs[1].getResolvedClassSchema().discriminant).toBe('kind');
        getSortedUnionTypes(u1, jsonTypeGuards);

        const u2 = t.union(a, b.clone()).buildPropertySchema();
        expect(u2.templateArgs[1].getResolvedClassSchema().discriminant).toBe('kind');
        getSortedUnionTypes(u2, jsonTypeGuards);
    }
});

test('test discriminator class to plain', () => {
    {
        const user = new User();
        if (user.config.kind === 'a') {
            user.config.myValue = 'abc';
        }
        const plain = jsonSerializer.for(User).serialize(user);
        expect(plain.config.kind).toBe('a');
    }

    {
        const user = new User();
        user.config = new ConfigB();
        const plain = jsonSerializer.for(User).serialize(user);
        expect(plain.config).not.toBeInstanceOf(ConfigB);
        expect(plain.config.kind).toBe('b');
    }
});

test('test discriminator plain to class', () => {
    {
        const plain = { config: { kind: 'a', myValue: 'abc' } };
        const user = jsonSerializer.for(User).deserialize(plain);
        expect(user.config).toBeInstanceOf(ConfigA);
    }

    {
        const plain = { config: { kind: 'b', myValue2: 'cdf' } };
        const user = jsonSerializer.for(User).deserialize(plain);
        expect(user.config).toBeInstanceOf(ConfigB);
    }
});

test('test discriminator in array', () => {
    {
        const user = new UserWithConfigArray();
        user.configs.push(new ConfigA());
        const plain = jsonSerializer.for(UserWithConfigArray).serialize(user);
        expect(plain.configs[0].kind).toBe('a');
    }

    {
        const user = new UserWithConfigArray();
        user.configs.push(new ConfigB());
        const plain = jsonSerializer.for(UserWithConfigArray).serialize(user);
        expect(plain.configs[0].kind).toBe('b');
    }

    {
        const user = new UserWithConfigArray();
        user.configs.push(new ConfigB());
        user.configs.push(new ConfigA());
        user.configs.push(new ConfigB());
        const plain = jsonSerializer.for(UserWithConfigArray).serialize(user);
        expect(plain.configs[0].kind).toBe('b');
        expect(plain.configs[1].kind).toBe('a');
        expect(plain.configs[2].kind).toBe('b');
    }
});

test('test discriminator in map', () => {
    {
        const user = new UserWithConfigMap();
        user.configs['first'] = new ConfigA();
        user.configs['first'].myValue = '123';

        const plain = jsonSerializer.for(UserWithConfigMap).serialize(user);
        expect(plain.configs.first.kind).toBe('a');
        expect((plain.configs.first as ConfigA).myValue).toBe('123');
    }

    {
        const user = new UserWithConfigMap();
        user.configs['first'] = new ConfigB();
        const plain = jsonSerializer.for(UserWithConfigMap).serialize(user);
        expect(plain.configs.first.kind).toBe('b');
    }

    {
        const user = new UserWithConfigMap();
        user.configs['first'] = new ConfigB();
        user.configs['second'] = new ConfigA();
        user.configs['third'] = new ConfigB();
        const plain = jsonSerializer.for(UserWithConfigMap).serialize(user);
        expect(plain.configs.first.kind).toBe('b');
        expect(plain.configs.second.kind).toBe('a');
        expect(plain.configs.third.kind).toBe('b');
    }
});

test('test discriminator validation', () => {
    {
        const plain = { config: { kind: 'a', myValue: 'abc' } };
        expect(validate(User, plain)).toEqual([]);
    }

    {
        const plain = { config: { kind: 'b', myValue2: 'cdf' } };
        expect(validate(User, plain)).toEqual([]);
    }

    {
        const plain = { config: { kind: 'c', moep: 'nope' } };
        expect(validate(User, plain)).toEqual([
            { code: 'invalid_union', message: 'No compatible type for union found', path: 'config' }
        ]);
    }
});

test('test discriminator validation in array', () => {
    {
        const plain = { configs: [{ kind: 'a', myValue: 'abc' }] };
        expect(validate(UserWithConfigArray, plain)).toEqual([]);
    }

    {
        const plain = { configs: [{ kind: 'b', myValue: 'cdf' }] };
        expect(validate(UserWithConfigArray, plain)).toEqual([]);
    }

    {
        const plain = { configs: [{ kind: 'c', nope: 'nope' }] };
        expect(validate(UserWithConfigArray, plain)).toEqual([
            { code: 'invalid_union', message: 'No compatible type for union found', path: 'configs.0' }
        ]);
    }
});

test('test discriminator no default value', () => {
    class ConfigA {
        @t.literal('a').discriminant
        kind: 'a' = 'a';

        @t
        myValue2: string = '';
    }

    class ConfigB {
        @t.discriminant
        kind!: 'b';

        @t
        myValue2: string = '';
    }

    class User {
        @t.union(ConfigA, ConfigB)
        config: ConfigA | ConfigB = new ConfigA;
    }

    {
        const user = new User();
        user.config = new ConfigB();
        expect(() => {
            jsonSerializer.for(User).serialize(user);
        }).toThrow('Discriminant ConfigB.kind has no default value');

        expect(() => {
            jsonSerializer.for(User).deserialize({});
        }).toThrow('Discriminant ConfigB.kind has no default value');

        expect(() => {
            validate(User, {});
        }).toThrow('Discriminant ConfigB.kind has no default value');
    }
});

test('correct serialization', () => {
    class C1 {
        @t.literal('c1-block').discriminant
        public type: 'c1-block' = 'c1-block';

        constructor(
            @t public id1: Date,
        ) {
        }
    }

    class C2 {
        @t.literal('c2-block').discriminant
        public type: 'c2-block' = 'c2-block';

        constructor(
            @t public id2: Date,
        ) {
        }
    }

    class UnionClass {
        @t.union(C1, C2)
        public value?: C1 | C2;
    }

    const klass = jsonSerializer.for(UnionClass).validatedDeserialize({
        value: {
            type: 'c2-block',
            id2: '2020-11-03T09:10:38.392Z',
        }
    });
    expect(klass.value!.type).toBe('c2-block');
    expect((klass.value! as C2).id2).toEqual(new Date('2020-11-03T09:10:38.392Z'));

    const plain = jsonSerializer.for(UnionClass).serialize(klass);
    expect(plain.value.type).toBe('c2-block');
    expect(plain.value.id2).toBe('2020-11-03T09:10:38.392Z');
});
