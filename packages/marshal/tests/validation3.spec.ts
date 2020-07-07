import 'jest-extended'
import {f, getClassSchema, PropertySchema, PropertyValidator} from "../src/decorators";
import {PropertyValidatorError, validate, ValidationFailed} from '../src/validation';
import {Channel, Job} from "./big-entity";
import {jitValidateProperty} from "../src/jit-validation";
import {uuid, validatedPlainToClass} from "../index";

test('test any deep array', async () => {
    class Peter {
        @f.array(String)
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

test('test any deep validation', async () => {
    const patches = {
        'infos': {},
        'infos.deep': 12,
        'infos.another.deep': '213',
        'infos.yes.another.very.deep.item': '444',
    };

    const propSchema = new PropertySchema('job');
    propSchema.setFromJSType(Job);
    propSchema.isPartial = true;

    const errors = jitValidateProperty(propSchema)(patches);

    expect(errors).toEqual([]);
});

test('test array optionalItem value', async () => {
    const value = [12313, null];

    const propSchema = getClassSchema(Channel).getProperty('lastValue');
    expect(propSchema.type).toBe('any');

    const errors = jitValidateProperty(propSchema)(value);

    expect(errors).toEqual([]);
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
        @f.primary().uuid()
        id: string = uuid();

        @f.validator(MyCustomValidator)
        @f.array(String)
        tags!: string[];

        @f.validator(MyCustomValidator)
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
