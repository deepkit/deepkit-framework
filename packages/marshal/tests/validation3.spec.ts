import 'jest-extended';
import 'reflect-metadata';
import {t, getClassSchema, PropertyValidator} from "../src/decorators";
import {PropertyValidatorError, validate, ValidationFailed} from '../src/validation';
import {Channel, Job} from "./big-entity";
import {jitValidateProperty} from "../src/jit-validation";
import {plainToClass, uuid, validatedPlainToClass} from '../index';

test('test any deep array', async () => {
    class Peter {
        @t.array(String)
        names: string[] = [];
    }

    const errors = validate(Peter, {
        names: ['valid', new Date]
    });

    expect(errors).toEqual([{
        "code": "invalid_string",
        "message": "No string given",
        "path": "names.1",
    }]);
});

test('test nested array', async () => {
    class Peter {
        @t.array(t.array(t.string))
        names: string[][] = [];
    }

    expect(validate(Peter, {names: ['invalid']})).toEqual([{
        "code": "invalid_type",
        "message": "Type is not an array",
        "path": "names.0",
    }]);

    expect(validate(Peter, {names: [[], 'asd']})).toEqual([{
        "code": "invalid_type",
        "message": "Type is not an array",
        "path": "names.1",
    }]);

    expect(validate(Peter, {names: [[], []]})).toEqual([]);
});

function MinStringLength(length: number) {
    return (v: string) => {
        if (v.length < length) throw new PropertyValidatorError('too_short', 'Min length of ' + length);
    }
}

test('test container validators array', async () => {
    class Peter {
        @t.array(t.string.validator(MinStringLength(3))).validator((v: string[]) => {
            if (v.length === 0) throw new PropertyValidatorError('empty', 'roles empty');
        })
        roles: string[] = [];
    }

    const schema = getClassSchema(Peter);
    const roles = schema.getProperty('roles');
    expect(roles.isArray).toBe(true);
    expect(roles.validators.length).toBe(1);
    expect(roles.getSubType().validators.length).toBe(1);

    expect(validate(Peter, {roles: []})).toEqual([{
        "code": "empty",
        "message": "roles empty",
        "path": "roles",
    }]);

    expect(validate(Peter, {roles: ['12']})).toEqual([{
        "code": "too_short",
        "message": "Min length of 3",
        "path": "roles.0",
    }]);

    expect(validate(Peter, {roles: ['123']})).toEqual([]);
});

test('test container validators map', async () => {
    class Peter {
        @t.map(t.string.validator(MinStringLength(3))).validator((v: string[]) => {
            if (Object.keys(v).length === 0) throw new PropertyValidatorError('empty', 'roles empty');
        })
        roles: {[name: string]: string } = {};
    }

    expect(validate(Peter, {roles: {}})).toEqual([{
        "code": "empty",
        "message": "roles empty",
        "path": "roles",
    }]);

    expect(validate(Peter, {roles: {'foo': 'ba'}})).toEqual([{
        "code": "too_short",
        "message": "Min length of 3",
        "path": "roles.foo",
    }]);

    expect(validate(Peter, {roles: {'foo': 'bar'}})).toEqual([]);
});

test('test any deep validation', async () => {
    const patches = {
        'infos': {},
        'infos.deep': 12,
        'infos.another.deep': '213',
        'infos.yes.another.very.deep.item': '444',
    };

    const propSchema = t.partial(Job).buildPropertySchema()

    const errors = jitValidateProperty(propSchema)(patches);

    expect(errors).toEqual([]);
});

test('test array optionalItem value', async () => {
    const value = [12313, null];

    const propSchema = getClassSchema(Channel).getProperty('lastValue');
    expect(propSchema.type).toBe('array');
    expect(propSchema.getSubType().type).toBe('any');

    expect(jitValidateProperty(propSchema)([12313, undefined])).toEqual([]);
    expect(jitValidateProperty(propSchema)([12313, null])).toEqual([{path: 'lastValue.1', message: 'Required value is null', code: 'required'}]);
});


test('test custom validator on array items', async () => {
    class MyCustomValidator implements PropertyValidator {
        validate<T>(value: any): PropertyValidatorError | void {
            if (value.length > 10) {
                return new PropertyValidatorError('too_long', 'Too long :()');
            }
        };
    }

    class SimpleModel {
        @t.primary.uuid
        id: string = uuid();

        @t.array(t.string.validator(MyCustomValidator))
        tags!: string[];

        @t.validator(MyCustomValidator)
        tag!: string;
    }

    try {
        const instance = validatedPlainToClass(SimpleModel, {
            name: 'myName',
            tags: ['foowererererefdrwerer', 'bar'],
            tag: 'foowererererefdrwerer',
        });
        fail('This should fail');
    } catch (error) {
        expect(error).toBeInstanceOf(ValidationFailed);
        expect(error.errors).toEqual([
            {code: "too_long", message: "Too long :()", path: "tags.0"},
            {code: "too_long", message: "Too long :()", path: "tag"},
        ])
    }
});