import { test } from 'node:test';

import { expect, fn } from '@deepkit/run/expect';

import { t } from '../src/decorator.js';
import { ReflectionClass, typeOf } from '../src/reflection/reflection.js';
import { Type } from '../src/reflection/type.js';
import { cast, castFunction, validatedDeserialize } from '../src/serializer-facade.js';
import { AutoIncrement, Email, Excluded, Group, MaxLength, MinLength, Positive, PrimaryKey, Unique, Validate, integer } from '../src/type-annotations.js';
import { assert, is } from '../src/typeguard.js';
import { ValidationError, ValidationErrorItem, ValidatorError, validate, validates } from '../src/validator.js';

test('primitives', () => {
    expect(validate<string>('Hello')).toEqual([]);
    expect(validate<string>(123)).toEqual([{ code: 'type', message: 'Not a string', path: '', value: 123 }]);

    expect(validate<number>('Hello')).toEqual([{ code: 'type', message: 'Cannot convert string "Hello" to number', path: '', value: 'Hello' }]);
    expect(validate<number>(123)).toEqual([]);
});

test('email', () => {
    expect(is<Email>('peter@example.com')).toBe(true);
    expect(is<Email>('nope')).toBe(false);
    expect(is<Email>('nope@')).toBe(false);
    expect(is<Email>('@')).toBe(false);
    expect(is<string & Email>('@')).toBe(false);

    expect(validate<Email>('peter@example.com')).toEqual([]);
    expect(validate<Email>('nope')).toEqual([{ path: '', code: 'pattern', message: `Pattern ^\\S+@\\S+$ does not match`, value: 'nope' }]);
    expect(validate<Email>('nope@')).toEqual([{ path: '', code: 'pattern', message: `Pattern ^\\S+@\\S+$ does not match`, value: 'nope@' }]);
    expect(validate<Email>('@')).toEqual([{ path: '', code: 'pattern', message: `Pattern ^\\S+@\\S+$ does not match`, value: '@' }]);
});

test('minLength', () => {
    type Username = string & MinLength<3>;

    expect(is<Username>('abc')).toBe(true);
    expect(is<Username>('ab')).toBe(false);

    expect(validate<Username>('abc')).toEqual([]);
    expect(validate<Username>('ab')).toEqual([{ path: '', code: 'minLength', message: `Min length is 3`, value: 'ab' }]);
});

test('custom validator pre defined', () => {
    function startsWith(v: string) {
        return (value: any) => {
            const valid = 'string' === typeof value && value.startsWith(v);
            return valid ? undefined : new ValidatorError('startsWith', `Does not start with ${v}`);
        };
    }

    const startsWithA = startsWith('a');
    type MyType = string & Validate<typeof startsWithA>;

    expect(is<MyType>('aah')).toBe(true);
    expect(is<MyType>('nope')).toBe(false);
    expect(validate<MyType>('nope')).toEqual([{ path: '', code: 'startsWith', message: `Does not start with a`, value: 'nope' }]);
});

test('custom validator with arguments', () => {
    function startsWith(value: any, type: Type, letter: string) {
        const valid = 'string' === typeof value && value.startsWith(letter);
        return valid ? undefined : new ValidatorError('startsWith', `Does not start with ${letter}`);
    }

    type MyType = string & Validate<typeof startsWith, 'a'>;

    expect(is<MyType>('aah')).toBe(true);
    expect(is<MyType>('nope')).toBe(false);
    expect(validate<MyType>('nope')).toEqual([{ path: '', code: 'startsWith', message: `Does not start with a`, value: 'nope' }]);

    type InvalidValidatorOption = string & Validate<typeof startsWith>;
    expect(() => is<InvalidValidatorOption>('aah')).toThrow(`Invalid option value given to validator function startsWith, expected letter: string`);
});

test('multiple custom validators with identical signatures', () => {
    const validator1: (value: any) => void = fn();
    const validator2: (value: any) => void = fn();

    type MyType = {
        a: string & Validate<typeof validator1>;
        b: string & Validate<typeof validator2>;
    };

    expect(is<MyType>({ a: 'a', b: 'b' })).toEqual(true);
    expect(validator1).toHaveBeenCalledTimes(1);
    expect(validator2).toHaveBeenCalledTimes(1);
});

test('decorator validator', () => {
    function minLength(length: number) {
        return (value: any): ValidatorError | void => {
            if ('string' === typeof value && value.length < length) return new ValidatorError('length', `Min length of ${length}`);
        };
    }

    class User {
        @t.validate(minLength(3))
        username!: string;
    }

    const reflection = ReflectionClass.from(User);
    const userType = typeOf<User>();
    //non-generic classes are cached
    expect(userType === reflection.type).toBe(true);

    expect(validate<User>({ username: 'Peter' })).toEqual([]);
    expect(validate<User>({ username: 'Pe' })).toEqual([{ path: 'username', code: 'length', message: `Min length of 3`, value: 'Pe' }]);
});

test('simple interface', () => {
    interface User {
        id: number;
        username: string;
    }

    expect(validate<User>(undefined)).toEqual([{ code: 'type', message: 'Not an object', path: '' }]);
    expect(is<User>({})).toEqual(false);
    expect(validate<User>({})).toEqual([
        { code: 'type', message: 'Not a number', path: 'id' },
        { code: 'type', message: 'Not a string', path: 'username' },
    ]);
    expect(validate<User>({ id: 1 })).toEqual([{ code: 'type', message: 'Not a string', path: 'username' }]);
    expect(validate<User>({ id: 1, username: 'Peter' })).toEqual([]);
});

test('simple class', () => {
    class User {
        id!: number;
        username!: string;
    }

    expect(validate<User>(undefined)).toEqual([{ code: 'type', message: 'Not an object', path: '' }]);
    expect(validate<User>({})).toEqual([
        { code: 'type', message: 'Not a number', path: 'id' },
        { code: 'type', message: 'Not a string', path: 'username' },
    ]);
    expect(validate<User>({ id: 1 })).toEqual([{ code: 'type', message: 'Not a string', path: 'username' }]);
    expect(validate<User>({ id: 1, username: 'Peter' })).toEqual([]);
});

test('class', () => {
    class User {
        id: integer & PrimaryKey & AutoIncrement & Positive = 0;

        email?: Email & Group<'sensitive'>;

        firstName?: string & MaxLength<128>;
        lastName?: string & MaxLength<128>;

        logins: integer & Positive & Excluded<'json'> = 0;

        constructor(public username: string & MinLength<3> & MaxLength<24> & Unique) {}
    }

    expect(is<User>({ id: 0, logins: 0, username: 'Peter' })).toBe(true);
    expect(is<User>({ id: -1, logins: 0, username: 'Peter' })).toBe(false);
    expect(is<User>({ id: 0, logins: 0, username: 'AB' })).toBe(false);
    expect(is<User>({ id: 0, logins: 0, username: 'Peter', email: 'abc@abc' })).toBe(true);
    expect(is<User>({ id: 0, logins: 0, username: 'Peter', email: 'abc' })).toBe(false);
});

test('path', () => {
    class Config {
        name!: string;
        value!: number;
    }

    class Container1 {
        configs: Config[] = [];
    }

    // expect(validate<Container1>({ configs: [{ name: 'a', value: 3 }] })).toEqual([]);
    expect(validate<Container1>({ configs: {} })).toEqual([{ code: 'type', message: 'Not an array', path: 'configs', value: {} }]);
    expect(validate<Container1>({ configs: [{ name: 'a', value: 123 }, { name: '12' }] })).toEqual([
        {
            code: 'type',
            message: 'Not a number',
            path: 'configs.1.value',
            value: undefined,
        },
    ]);

    class Container2 {
        configs: { [name: string]: Config } = {};
    }

    expect(validate<Container2>({ configs: { a: { name: 'b' } } })).toEqual([{ code: 'type', message: 'Not a number', path: 'configs.a.value' }]);
    expect(validate<Container2>({ configs: { a: { name: 'b', value: 123 }, b: { name: 'b' } } })).toEqual([{ code: 'type', message: 'Not a number', path: 'configs.b.value' }]);
});

test('class with union literal', () => {
    class ConnectionOptions {
        readConcernLevel: 'local' | 'majority' | 'linearizable' | 'available' = 'majority';
    }

    expect(validate<ConnectionOptions>({ readConcernLevel: 'majority' })).toEqual([]);
    const errors = validate<ConnectionOptions>({ readConcernLevel: 'invalid' });
    expect(errors.length).toBe(1);
    expect(errors[0].code).toBe('type');
    expect(errors[0].path).toBe('readConcernLevel');
    expect(errors[0].value).toBe('invalid');
    expect(errors[0].message).toContain('Cannot convert');
    expect(errors[0].message).toContain("'local' | 'majority' | 'linearizable' | 'available'");
});

test('named tuple', () => {
    expect(validate<[name: string]>(['asd'])).toEqual([]);
    expect(validate<[name: string]>([23])).toEqual([{ code: 'type', message: 'Not a string', path: 'name', value: 23 }]);
});

test('inherited validations', () => {
    class User {
        username!: string & MinLength<3>;
    }

    class AddUserDto extends User {
        image?: string;
    }

    expect(validate<User>({ username: 'Pe' })).toEqual([{ code: 'minLength', message: 'Min length is 3', path: 'username', value: 'Pe' }]);
    expect(validate<User>({ username: 'Peter' })).toEqual([]);

    expect(validate<AddUserDto>({ username: 'Pe' })).toEqual([{ code: 'minLength', message: 'Min length is 3', path: 'username', value: 'Pe' }]);
    expect(validate<AddUserDto>({ username: 'Peter' })).toEqual([]);
});

test('mapped type', () => {
    type Api = {
        inc(x: number): number;
        dup(x: string): string;
    };
    type Request = {
        [Method in keyof Api]: {
            method: Method;
            arguments: Parameters<Api[Method]>;
        };
    }[keyof Api];

    type Response = {
        [Method in keyof Api]: {
            method: Method;
            result: ReturnType<Api[Method]>;
        };
    }[keyof Api];

    expect(validate<Request>({ method: 'inc', arguments: [4] })).toEqual([]);

    expect(validate<Request>({ method: 'dup', arguments: [''] })).toEqual([]);
    expect(validate<Request>({ method: 'inc', arguments: [''] })).not.toEqual([]);
    expect(validate<Request>({ method: 'unc', arguments: [''] })).not.toEqual([]);

    expect(validate<Response>({ method: 'inc', result: 4 })).toEqual([]);
    expect(validate<Response>({ method: 'dup', result: '' })).toEqual([]);

    expect(validate<Response>({ method: 'inc', result: '' })).not.toEqual([]);
    expect(validate<Request>({ method: 'enc', result: '' })).not.toEqual([]);
});

test('assert union', () => {
    expect(validates<'a' | 'b'>('a')).toBe(true);
    expect(validates<'a' | 'b'>('b')).toBe(true);
    expect(validates<'a' | 'b'>('c')).toBe(false);

    expect(() => assert<'a' | 'b'>('a')).not.toThrow();
    expect(() => assert<'a' | 'b'>('b')).not.toThrow();
    expect(() => assert<'a' | 'b'>('c')).toThrow('Validation error');

    // Verify error code for ValidationError
    try {
        assert<'a' | 'b'>('c');
    } catch (error: any) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.code).toBe('DK-T300'); // ValidationError error code
    }
});

test('inline object', () => {
    //there was a bug where array checks do not correctly set validation state to true if array is empty, so all subsequent properties
    //are not checked correctly. this test case makes sure this works as expected.
    interface Post {
        tags: string[];
        collection: {
            items: string[];
        };
    }

    const errors = validate<Post>({
        tags: [],
        collection: {}, // This should make the validator throw an error
    });

    expect(errors).toEqual([{ path: 'collection.items', code: 'type', message: 'Not an array' }]);
    expect(() =>
        validatedDeserialize<Post>({
            tags: [],
            collection: {}, // This should make the validator throw an error
        }),
    ).toThrow('collection.items(type): Not an array');
});

test('readonly constructor properties', () => {
    class Pilot {
        constructor(
            readonly name: string,
            readonly age: number,
        ) {}
    }

    expect(validate<Pilot>({ name: 'Peter', age: 32 })).toEqual([]);
    expect(validate<Pilot>({ name: 'Peter', age: 'sdd' })).toEqual([{ code: 'type', message: 'Cannot convert string "sdd" to number', path: 'age', value: 'sdd' }]);
});

test('class with statics', () => {
    class PilotId {
        public static readonly none: PilotId = new PilotId(0);

        constructor(public readonly value: number) {}

        static from(value: number) {
            return new PilotId(value);
        }
    }

    expect(validate<PilotId>({ value: 34 })).toEqual([]);
    expect(validate<PilotId>({ value: '33' })).toEqual([{ code: 'type', message: 'Cannot convert string "33" to number', path: 'value', value: '33' }]);
});

test('date', () => {
    class Account {
        public name!: string;
        public createdAt!: Date;
    }

    expect(validate<Account>({ name: 'jack', createdAt: 'asd' })).toEqual([{ code: 'type', message: 'Not a Date', path: 'createdAt', value: 'asd' }]);
});

test('array with multiple errors', () => {
    interface Skill {
        level: number & Positive;
    }

    const errors = validate<Array<Skill>>([{ level: -1 }, { level: -1 }]);

    expect(errors).toEqual([
        { code: 'positive', message: 'Number needs to be positive', path: '0.level', value: -1 },
        { code: 'positive', message: 'Number needs to be positive', path: '1.level', value: -1 },
    ]);
});

test('union with constraints shows specific validation error (#577)', () => {
    // Issue #577: When a union member fails validation due to constraints (like MinLength),
    // the error should show the specific constraint violation, not "No valid union member found"

    class MyClass {
        code!: (string & MinLength<1> & MaxLength<2>) | null;
    }

    // Valid cases
    expect(validate<MyClass>({ code: 'a' })).toEqual([]);
    expect(validate<MyClass>({ code: 'ab' })).toEqual([]);
    expect(validate<MyClass>({ code: null })).toEqual([]);

    // Empty string fails MinLength<1> - should show minLength error, not "No valid union member found"
    const emptyStringErrors = validate<MyClass>({ code: '' });
    expect(emptyStringErrors.length).toBe(1);
    expect(emptyStringErrors[0].path).toBe('code');
    expect(emptyStringErrors[0].code).toBe('minLength');
    expect(emptyStringErrors[0].message).toBe('Min length is 1');

    // String too long fails MaxLength<2> - should show maxLength error
    const tooLongErrors = validate<MyClass>({ code: 'abc' });
    expect(tooLongErrors.length).toBe(1);
    expect(tooLongErrors[0].path).toBe('code');
    expect(tooLongErrors[0].code).toBe('maxLength');
    expect(tooLongErrors[0].message).toBe('Max length is 2');
});

test('union with multiple constrained types shows correct constraint error (#577)', () => {
    // When multiple union members have constraints, show the error from the matching base type

    type Value = (string & MinLength<1>) | (number & Positive);

    // Valid cases
    expect(validate<Value>('hello')).toEqual([]);
    expect(validate<Value>(42)).toEqual([]);

    // Empty string - base type is string, so show string's constraint error
    const emptyStringErrors = validate<Value>('');
    expect(emptyStringErrors.length).toBe(1);
    expect(emptyStringErrors[0].code).toBe('minLength');

    // Negative number - base type is number, so show number's constraint error
    const negativeErrors = validate<Value>(-5);
    expect(negativeErrors.length).toBe(1);
    expect(negativeErrors[0].code).toBe('positive');

    // Boolean - no base type matches, show generic union error
    const booleanErrors = validate<Value>(true as any);
    expect(booleanErrors.length).toBe(1);
    expect(booleanErrors[0].code).toBe('type');
    expect(booleanErrors[0].message).toContain('Cannot convert');
});

test('union with nested objects shows deep constraint errors (#577)', () => {
    // Test complex union with three object types and deep constraint failures

    interface ClickEvent {
        type: 'click';
        x: number & Positive;
        y: number & Positive;
    }

    interface ScrollEvent {
        type: 'scroll';
        offset: number;
    }

    interface InputEvent {
        type: 'input';
        value: string & MinLength<1>;
    }

    type Event = ClickEvent | ScrollEvent | InputEvent;

    // Valid cases
    expect(validate<Event>({ type: 'click', x: 10, y: 20 })).toEqual([]);
    expect(validate<Event>({ type: 'scroll', offset: 100 })).toEqual([]);
    expect(validate<Event>({ type: 'input', value: 'hello' })).toEqual([]);

    // Deep constraint failure: x is negative in ClickEvent
    const clickErrors = validate<Event>({ type: 'click', x: -5, y: 10 });
    expect(clickErrors.length).toBeGreaterThanOrEqual(1);
    // Should show the specific constraint error, not generic union error
    const positiveError = clickErrors.find(e => e.code === 'positive');
    expect(positiveError).toBeDefined();
    expect(positiveError!.path).toBe('x');

    // Deep constraint failure: value is empty in InputEvent
    const inputErrors = validate<Event>({ type: 'input', value: '' });
    expect(inputErrors.length).toBeGreaterThanOrEqual(1);
    const minLengthError = inputErrors.find(e => e.code === 'minLength');
    expect(minLengthError).toBeDefined();
    expect(minLengthError!.path).toBe('value');

    // Completely wrong discriminant - shows errors from closest matching member
    // This is more helpful than generic "No valid union member found" because it indicates
    // what specifically was wrong (discriminator didn't match)
    const wrongTypeErrors = validate<Event>({ type: 'unknown' } as any);
    expect(wrongTypeErrors.length).toBeGreaterThanOrEqual(1);
    // Should show the discriminator error from closest match, prefixed with type name
    const typeError = wrongTypeErrors.find(e => e.path.endsWith('.type') || e.path === 'type');
    expect(typeError).toBeDefined();
});

test('union with object structural errors shows specific field errors', () => {
    // When an object almost matches a union member but has missing/wrong fields,
    // we should show specific errors about what's wrong, not just "No valid union member found"

    interface ClickEvent {
        type: 'click';
        x: number;
        y: number;
    }
    interface ScrollEvent {
        type: 'scroll';
        offset: number;
    }
    type Event = ClickEvent | ScrollEvent;

    // Missing required field 'y' - should indicate which field is missing
    const missingFieldErrors = validate<Event>({ type: 'click', x: 5 });
    expect(missingFieldErrors.length).toBeGreaterThanOrEqual(1);
    // We want a specific error about the missing 'y' field, not just generic "No valid union member found"
    // The error should have path like 'ClickEvent.y' indicating exactly which field is the problem
    const yError = missingFieldErrors.find(e => e.path === 'ClickEvent.y');
    expect(yError).toBeDefined();
    expect(yError!.code).toBe('type'); // 'y' is undefined, doesn't match number

    // Typo in field name (Y instead of y) - should indicate the field issue
    const typoErrors = validate<Event>({ type: 'click', x: 5, Y: 10 } as any);
    expect(typoErrors.length).toBeGreaterThanOrEqual(1);
    // Should indicate 'y' is missing with a specific path, not just generic union error
    const typoYError = typoErrors.find(e => e.path === 'ClickEvent.y');
    expect(typoYError).toBeDefined();
});

test('ValidationErrorItem.toString() handles circular references (#505)', () => {
    // Create an object with a circular reference
    const circularObj: any = { name: 'test' };
    circularObj.self = circularObj;

    // Creating a ValidationErrorItem with circular value should not throw
    const errorItem = new ValidationErrorItem('path', 'type', 'Not valid', circularObj);

    // toString() should not throw and should produce a meaningful string
    expect(() => errorItem.toString()).not.toThrow();
    const errorString = errorItem.toString();
    expect(errorString).toContain('path(type): Not valid');
    expect(errorString).toContain('caused by value');
});

test('ValidationError has correct error code', () => {
    // ValidationError should have error code DK-T300
    const errors = [new ValidationErrorItem('field', 'type', 'Not valid')];
    const validationError = new ValidationError(errors);

    expect(validationError).toBeInstanceOf(ValidationError);
    expect(validationError.code).toBe('DK-T300'); // ValidationError error code
    expect(validationError.errors).toHaveLength(1);
    expect(validationError.errors[0].path).toBe('field');
});
