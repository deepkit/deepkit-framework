import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { getClassSchema, jitValidatePartial, jitValidateProperty, resolvePropertySchema, t } from '../index';

test('test partial @f.map(any)', async () => {
    const p = t.map(t.any).buildPropertySchema();

    expect(jitValidateProperty(p)({})).toEqual([]);
    expect(jitValidateProperty(p)({
        'peter': [23],
        'another': 'yes'
    })).toEqual([]);
});

test('test partial @f.map(any) on class', async () => {
    class Job {
        @t.array(String)
        strings: any[] = [];

        @t.array(t.any)
        array: any[] = [];

        @t.map(t.any)
        values: {} = {};

        @t.any
        any: {} = {};
    }

    const schema = getClassSchema(Job);

    expect(schema.getProperty('strings').isArray).toBe(true);
    expect(schema.getProperty('strings').getSubType().type).toBe('string');
    expect(schema.getProperty('array').isArray).toBe(true);
    expect(schema.getProperty('array').getSubType().type).toBe('any');
    expect(schema.getProperty('values').isRecord).toBe(true);
    expect(schema.getProperty('values').getSubType().type).toBe('any');
    expect(schema.getProperty('any').type).toBe('any');

    {
        const p = resolvePropertySchema(schema, 'values');
        expect(p.name).toBe('values');
        expect(p.isRecord).toBe(true);
        expect(p.getSubType().type).toBe('any');
    }

    {
        const p = resolvePropertySchema(schema, 'values.peter');
        expect(p.isRecord).toBe(false);
        expect(p.type).toBe('any');
    }

    {
        const p = resolvePropertySchema(schema, 'values.peter.deep');
        expect(p.isRecord).toBe(false);
        expect(p.type).toBe('any');
    }

    const errors = jitValidatePartial(Job, {
        'values.peter': [1, 2, 3],
        'values.23': 'asd',
        'values.23.asdasda.asdasdadd.asd': 'asd',
        'any': { 'asdasdasd': true },
    });

    expect(errors).toEqual([]);
});
