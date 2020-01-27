import 'reflect-metadata';
import 'jest-extended'
import {f, getClassSchema, PropertySchema} from "../src/decorators";
import {validate, validatePropSchema} from '../src/validation';
import {Channel, Job, JobTask} from "./big-entity";
import {getResolvedReflection} from "..";

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

    expect(getResolvedReflection(Job, 'tasks')!.type).toBe('class');
    expect(getResolvedReflection(Job, 'tasks')!.map).toBe(true);
    expect(getResolvedReflection(Job, 'tasks.asdasd')!.type).toBe('class');
    expect(getResolvedReflection(Job, 'tasks.asdasd')!.map).toBe(false);
    expect(getResolvedReflection(Job, 'tasks.asdasd')!.typeValue).toBe(JobTask);
    expect(getResolvedReflection(Job, 'tasks.asdasd')!.propertySchema.type).toBe('class');
    expect(getResolvedReflection(Job, 'tasks.asdasd')!.propertySchema.isMap).toBe(true);
    expect(getResolvedReflection(Job, 'tasks.asdasd')!.propertySchema.getResolvedClassType()).toBe(JobTask);
    expect(getResolvedReflection(Job, 'tasks.asdasd.assigned')!.type).toBe('date');
    expect(getResolvedReflection(Job, 'tasks.asdasd.assigned')!.propertySchema.type).toBe('date');
    expect(getResolvedReflection(Job, 'tasks.asdasd.assigned')!.propertySchema.isMap).toBe(false);
    expect(getResolvedReflection(Job, 'tasks.asdasd.docker')!.type).toBe('class');
    expect(getResolvedReflection(Job, 'tasks.asdasd.docker.runOnVersion')!.type).toBe('string');

    expect(getResolvedReflection(Job, 'infos')!.type).toBe('any');
    expect(getResolvedReflection(Job, 'infos')!.partial).toBe(false);
    expect(getResolvedReflection(Job, 'infos')!.map).toBe(true);
    expect(getResolvedReflection(Job, 'infos')!.array).toBe(false);

    expect(getResolvedReflection(Job, 'infos.deep')!.type).toBe('any');
    expect(getResolvedReflection(Job, 'infos.deep')!.partial).toBe(false);
    expect(getResolvedReflection(Job, 'infos.deep')!.array).toBe(false);
    expect(getResolvedReflection(Job, 'infos.deep')!.map).toBe(false);

    expect(getResolvedReflection(Job, 'infos.another.deep')!.type).toBe('any');
    expect(getResolvedReflection(Job, 'infos.another.deep')!.partial).toBe(false);
    expect(getResolvedReflection(Job, 'infos.another.deep')!.array).toBe(false);
    expect(getResolvedReflection(Job, 'infos.another.deep')!.map).toBe(false);

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
