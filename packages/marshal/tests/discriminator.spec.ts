import 'jest-extended'
import {classToPlain, f, getClassSchema, plainToClass, PropertyCompilerSchema, validate} from "../index";

class ConfigA {
    @f.discriminant()
    kind: 'a' = 'a';

    @f
    myValue: string = '';
}

class ConfigB {
    @f.discriminant()
    kind: 'b' = 'b';

    @f
    myValue2: string = '';
}

class User {
    @f.union(ConfigA, ConfigB)
    config: ConfigA | ConfigB = new ConfigA;
}

class UserWithConfigArray {
    @f.array(ConfigA, ConfigB)
    configs: (ConfigA | ConfigB)[] = [];
}

class UserWithConfigMap {
    @f.map(ConfigA, ConfigB)
    configs: {[name: string]: (ConfigA | ConfigB)} = {};
}

test('test discriminator schema', () => {
    const schema = getClassSchema(User);
    const config = schema.getProperty('config');
    expect(config.type).toBe('union');
    expect(config.getResolvedUnionTypes()).toEqual([ConfigA, ConfigB]);
    expect(config.getResolvedClassTypeForValidType()).toEqual([ConfigA, ConfigB]);

    const schemaConfigA = getClassSchema(ConfigA);
    expect(schemaConfigA.getProperty('kind').type).toBe('string');
    expect(schemaConfigA.getProperty('kind').isDiscriminant).toBe(true);
    expect(schemaConfigA.getProperty('myValue').isDiscriminant).toBe(false);
    expect(schemaConfigA.getProperty('myValue').isArray).toBe(false);
    expect(schemaConfigA.getProperty('myValue').type).toBe('string');

    const compilerSchema = PropertyCompilerSchema.createFromPropertySchema(config);
    expect(compilerSchema.resolveUnionTypes).toEqual([ConfigA, ConfigB]);
});

test('test discriminator class to plain', () => {
    {
        const user = new User();
        if (user.config.kind === 'a') {
            user.config.myValue = 'abc';
        }
        const plain = classToPlain(User, user);
        expect(plain.config.kind).toBe('a');
    }

    {
        const user = new User();
        user.config = new ConfigB();
        const plain = classToPlain(User, user);
        expect(plain.config.kind).toBe('b');
    }
});

test('test discriminator plain to class', () => {
    {
        const plain = { config: { kind: 'a', myValue: 'abc' }};
        const user = plainToClass(User, plain);
        expect(user.config).toBeInstanceOf(ConfigA);
    }

    {
        const plain = { config: { kind: 'b', myValue2: 'cdf' } };
        const user = plainToClass(User, plain);
        expect(user.config).toBeInstanceOf(ConfigB);
    }
});

test('test discriminator in array', () => {
    {
        const user = new UserWithConfigArray();
        user.configs.push(new ConfigA());
        const plain = classToPlain(UserWithConfigArray, user);
        expect(plain.configs[0].kind).toBe('a');
    }

    {
        const user = new UserWithConfigArray();
        user.configs.push(new ConfigB());
        const plain = classToPlain(UserWithConfigArray, user);
        expect(plain.configs[0].kind).toBe('b');
    }

    {
        const user = new UserWithConfigArray();
        user.configs.push(new ConfigB());
        user.configs.push(new ConfigA());
        user.configs.push(new ConfigB());
        const plain = classToPlain(UserWithConfigArray, user);
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
        const plain = classToPlain(UserWithConfigMap, user);
        expect(plain.configs.first.kind).toBe('a');
        expect(plain.configs.first.myValue).toBe('123');
    }

    {
        const user = new UserWithConfigMap();
        user.configs['first'] = new ConfigB();
        const plain = classToPlain(UserWithConfigMap, user);
        expect(plain.configs.first.kind).toBe('b');
    }

    {
        const user = new UserWithConfigMap();
        user.configs['first'] = new ConfigB();
        user.configs['second'] = new ConfigA();
        user.configs['third'] = new ConfigB();
        const plain = classToPlain(UserWithConfigMap, user);
        expect(plain.configs.first.kind).toBe('b');
        expect(plain.configs.second.kind).toBe('a');
        expect(plain.configs.third.kind).toBe('b');
    }
});

test('test discriminator validation', () => {
    {
        const plain = { config: { kind: 'a', myValue: 'abc' }};
        expect(validate(User, plain)).toEqual([]);
    }

    {
        const plain = { config: { kind: 'b', myValue2: 'cdf' } };
        expect(validate(User, plain)).toEqual([]);
    }

    {
        const plain = { config: { kind: 'c', moep: 'nope' } };
        expect(validate(User, plain)).toEqual([
            {code: 'invalid_type', message: 'Invalid union type given. No valid discriminant was found.', path: 'config'}
        ]);
    }
});

test('test discriminator validation in array', () => {
    {
        const plain = { configs: [{ kind: 'a', myValue: 'abc' }]};
        expect(validate(UserWithConfigArray, plain)).toEqual([]);
    }

    {
        const plain = { configs: [{ kind: 'b', myValue: 'cdf' }]};
        expect(validate(UserWithConfigArray, plain)).toEqual([]);
    }

    {
        const plain = { configs: [{ kind: 'c', nope: 'nope' }]};
        expect(validate(UserWithConfigArray, plain)).toEqual([
            {code: 'invalid_type', message: 'Invalid union type given. No valid discriminant was found.', path: 'configs.0'}
        ]);
    }
});
