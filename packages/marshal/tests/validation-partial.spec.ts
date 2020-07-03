import 'reflect-metadata';
import 'jest-extended'
import {f, getClassSchema, PropertySchema} from "../src/decorators";
import {jitValidatePartial, jitValidateProperty, resolvePropertyCompilerSchema} from "..";

test('test partial @f.map(any)', async () => {
    const p = new PropertySchema('#0');
    p.type = 'any';
    p.isMap = true;

    expect(jitValidateProperty(p)({})).toEqual([]);
    expect(jitValidateProperty(p)({
        'peter': [23],
        'another': 'yes'
    })).toEqual([]);
});

test('test partial @f.map(any) on class', async () => {
    class Job {
        @f.array(String)
        strings: any[] = [];

        @f.array('any')
        array: any[] = [];

        @f.map('any')
        values: {} = {};

        @f.any()
        any: {} = {};
    }

    const schema = getClassSchema(Job);

    expect(schema.getProperty('strings').type).toBe('string');
    expect(schema.getProperty('strings').isArray).toBe(true);
    expect(schema.getProperty('array').type).toBe('any');
    expect(schema.getProperty('array').isArray).toBe(true);
    expect(schema.getProperty('values').type).toBe('any');
    expect(schema.getProperty('values').isMap).toBe(true);
    expect(schema.getProperty('any').type).toBe('any');

    {
        const p = resolvePropertyCompilerSchema(schema, 'values');
        expect(p.name).toBe('values');
        expect(p.isMap).toBe(true);
        expect(p.type).toBe('any');
    }

    {
        const p = resolvePropertyCompilerSchema(schema, 'values.peter');
        expect(p.name).toBe('values');
        expect(p.isMap).toBe(false);
        expect(p.type).toBe('any');
    }

    {
        const p = resolvePropertyCompilerSchema(schema, 'values.peter.deep');
        expect(p.name).toBe('values');
        expect(p.isMap).toBe(false);
        expect(p.type).toBe('any');
    }

    const errors = jitValidatePartial(Job, {
        'values.peter': [1, 2, 3],
        'values.23': 'asd',
        'values.23.asdasda.asdasdadd.asd': 'asd',
        'any': {'asdasdasd': true},
    });

    expect(errors).toEqual([]);
});
