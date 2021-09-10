import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { classToPlain, plainToClass, validatedPlainToClass } from '../src/json-serializer';
import { t } from '../src/decorators';
import { PropertyValidatorError } from '../src/jit-validation';

function isInteger(v: any) {
    if (!Number.isInteger) throw new PropertyValidatorError('integer', 'Not an integer');
}

test('deserialize', () => {
    const s = t.schema({
        type: t.number.deserialize(Math.trunc).validator(isInteger),
    });

    expect(plainToClass(s, { type: 5.5 }).type).toBe(5);

    //validation happens after deserialization
    expect(validatedPlainToClass(s, { type: 5.5 }).type).toBe(5);
});

test('serialize', () => {
    class Model {
        @t.serialize(Math.trunc).validator(isInteger) type!: number;
    }

    const m = new Model;
    m.type = 55.5;

    expect(classToPlain(Model, m).type).toBe(55);
});

test('transform', () => {
    class Model {
        @t.transform(Math.trunc).validator(isInteger) type!: number;
    }

    const m = new Model;
    m.type = 55.5;

    expect(classToPlain(Model, m).type).toBe(55);

    expect(plainToClass(Model, { type: 5.5 }).type).toBe(5);

    //validation happens after deserialization
    expect(validatedPlainToClass(Model, { type: 5.5 }).type).toBe(5);
});
