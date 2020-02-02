import 'reflect-metadata';
import 'jest-extended'
import {f, getClassSchema, PropertySchema} from "../src/decorators";
import {validate, validatePropSchema} from '../src/validation';
import {Channel, Job, JobTask} from "./big-entity";

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
        "message": "No String given",
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

    const errors: any[] = [];
    validatePropSchema(
        Object,
        propSchema,
        errors,
        patches,
        '0',
        'propertyPath.0',
        false
    );

    expect(errors).toEqual([]);
});

test('test array optionalItem value', async () => {
    const value = [12313, null];

    const propSchema = getClassSchema(Channel).getProperty('lastValue');
    expect(propSchema.type).toBe('any');
    const errors: any[] = [];

    validatePropSchema(
        Object,
        propSchema,
        errors,
        value,
        'lastValue',
        'lastValue',
        false
    );

    expect(errors).toEqual([]);
});
