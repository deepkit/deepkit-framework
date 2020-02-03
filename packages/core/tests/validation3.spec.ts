import 'reflect-metadata';
import 'jest-extended'
import {f, getClassSchema, PropertySchema} from "../src/decorators";
import {validate} from '../src/validation';
import {Channel, Job} from "./big-entity";
import {jitValidateProperty} from "../src/jit-validation";

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
