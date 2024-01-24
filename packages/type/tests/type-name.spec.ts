import { expect, test } from '@jest/globals';

import { ReflectionClass, typeOf } from '../src/reflection/reflection.js';
import { ReflectionKind, assertType } from '../src/reflection/type.js';

test('keep type name', () => {
    type T<a> = a;
    type T2 = T<string>;

    {
        const type = typeOf<T2>();
        expect(type.typeName).toBe('T2');
        expect(type.typeArguments).toBe(undefined);
        expect(type.originTypes).toHaveLength(1);
        expect(type.originTypes![0].typeName).toBe('T');
        expect(type.originTypes![0].typeArguments![0].kind).toBe(ReflectionKind.string);
    }

    type T3 = T2;
    type T4 = T2;

    {
        const type = typeOf<T3>();
        expect(type.typeName).toBe('T3');
        expect(type.typeArguments).toBe(undefined);
        expect(type.originTypes).toHaveLength(2);
        expect(type.originTypes![0].typeName).toBe('T2');
        expect(type.originTypes![0].typeArguments).toBe(undefined);
        expect(type.originTypes![1].typeName).toBe('T');
        expect(type.originTypes![1].typeArguments![0].kind).toBe(ReflectionKind.string);
    }

    {
        // test T2 again, to make sure cached entry is not modified
        const type = typeOf<T2>();
        expect(type.typeName).toBe('T2');
        expect(type.typeArguments).toBe(undefined);
        expect(type.originTypes).toHaveLength(1);
        expect(type.originTypes![0].typeName).toBe('T');
        expect(type.originTypes![0].typeArguments![0].kind).toBe(ReflectionKind.string);
    }

    {
        const type = typeOf<T4>();
        expect(type.typeName).toBe('T4');
        expect(type.typeArguments).toBe(undefined);
        expect(type.originTypes).toHaveLength(2);
        expect(type.originTypes![0].typeName).toBe('T2');
        expect(type.originTypes![0].typeArguments).toBe(undefined);
        expect(type.originTypes![1].typeName).toBe('T');
        expect(type.originTypes![1].typeArguments![0].kind).toBe(ReflectionKind.string);
    }
});

test('keep last type name', () => {
    interface User {
        id: number;
        name: string;
        password: string;
    }

    {
        type ReadUser = Omit<User, 'password'>;
        const type = typeOf<ReadUser>();
        expect(type.typeName).toBe('ReadUser');
        expect(type.originTypes![0].typeName).toBe('Omit');
    }

    {
        type UserWithName = Pick<User, 'name'>;
        const type = typeOf<UserWithName>();
        expect(type.typeName).toBe('UserWithName');
        expect(type.typeArguments).toBe(undefined);
        expect(type.originTypes![0].typeName).toBe('Pick');
        expect(type.originTypes![0].typeArguments![0].typeName).toBe('User');
    }

    {
        type UserWithName = Pick<User, 'name'>;
        type Bla = UserWithName;
        const type = typeOf<Bla>();
        const type2 = typeOf<UserWithName>();

        expect(type.typeName).toBe('Bla');
        expect(type.typeArguments).toBe(undefined);
        expect(type.originTypes![0].typeName).toBe('UserWithName');
        expect(type.originTypes![0].typeArguments).toBe(undefined);
        expect(type.originTypes![1].typeName).toBe('Pick');
        expect(type.originTypes![1].typeArguments![0].typeName).toBe('User');

        expect(type2.typeName).toBe('UserWithName');
        expect(type2.originTypes![0].typeName).toBe('Pick');
        expect(type2.originTypes![0].typeArguments![0].typeName).toBe('User');
    }
});

test('class emit typeName', () => {
    class Entity {}

    class Entity2 {
        string!: number;
    }

    /**
     * @description my Entity 3
     */
    class Entity3 {}

    const type1 = typeOf<Entity>();
    const type2 = typeOf<Entity2>();
    const type3 = typeOf<Entity3>();

    expect(type1.typeName).toBe('Entity');
    expect(type2.typeName).toBe('Entity2');
    expect(type3.typeName).toBe('Entity3');

    assertType(type3, ReflectionKind.class);
    expect(type3.description).toBe('my Entity 3');

    const reflection = ReflectionClass.from(Entity);
    expect(reflection.getName()).toBe('Entity');
    expect(reflection.getClassName()).toBe('Entity');
});
