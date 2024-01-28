import { expect, test } from '@jest/globals';
import { assertType, integer, ReflectionKind } from '../src/reflection/type.js';
import { ReflectionClass, typeOf } from '../src/reflection/reflection.js';
import { expectEqualType } from './utils.js';

interface User {
    readonly id: integer;
    readonly name?: string;
    readonly address: string;
    readonly postcode: string;
}

type PartialUser = Pick<
    User,
    'id' | 'name'
>;

test('the optional modifier should be retained after a mapped type', () => {
    // This has always worked: checking the optional property on the original type
    const reflectionClass = ReflectionClass.from<User>();
    expect(reflectionClass.getProperty('id').isOptional()).toBe(false);
    expect(reflectionClass.getProperty('name').isOptional()).toBe(true);

    // ...but it should work if we map it with - e.g., Pick - too.
    const partialReflectionClass = ReflectionClass.from<PartialUser>();
    expect(partialReflectionClass.getProperty('id').isOptional()).toBe(false);
    expect(partialReflectionClass.getProperty('name').isOptional()).toBe(true);
});

type Test = {name: User['name'], address: User['address']};
type Username = User['name'];
type Username2 = Test['name'];

test('the optional property should not carry over when a property is mapped (consistent with TypeScript)', () => {
    const reflectionClass = ReflectionClass.from<User>();
    expect(reflectionClass.getProperty('address').isOptional()).toBe(false); // (sanity check)
    expect(reflectionClass.getProperty('name').isOptional()).toBe(true);

    const alteredReflectionClass = ReflectionClass.from<Test>();
    expect(alteredReflectionClass.getProperty('address').isOptional()).toBe(false); // (sanity check)
    expect(alteredReflectionClass.getProperty('name').isOptional()).toBe(false);

    const username = typeOf<Username>();
    assertType(username, ReflectionKind.string);

    const username2 = typeOf<Username2>();
    assertType(username2, ReflectionKind.string);
});

type UserNestedType = Omit<Pick<
    User,
    'id' | 'name' | 'address'
>, 'id'>;

test('nested mapped types should work', () => {
    type Test = {name: User['name'], address: User['address']};
    const test = typeOf<Test>();
    assertType(test, ReflectionKind.objectLiteral);
    assertType(test.types[0], ReflectionKind.propertySignature);
    assertType(test.types[1], ReflectionKind.propertySignature);
    expect(test.types[0].name).toBe('name');
    expect(test.types[0].optional).toBe(undefined);
    expect(test.types[0].readonly).toBe(undefined);
    expect(test.types[1].name).toBe('address');
    expect(test.types[1].optional).toBe(undefined);
    expect(test.types[1].readonly).toBe(undefined);

    const type = typeOf<UserNestedType>();
    assertType(type, ReflectionKind.objectLiteral);
    assertType(type.types[0], ReflectionKind.propertySignature);
    assertType(type.types[1], ReflectionKind.propertySignature);

    expect(type.types[0].name).toBe('name');
    expect(type.types[0].optional).toBe(true);
    expect(type.types[0].readonly).toBe(true);
    expect(type.types[1].name).toBe('address');
    expect(type.types[1].optional).toBe(undefined);
    expect(type.types[1].readonly).toBe(true);
});

