import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { jsonSerializer, t, validate } from '../index';

test('literal', () => {
    const s = t.schema({
        type: t.literal('a'),
        type2: t.literal(2),
        type3: t.literal(false),
    });

    expect(s.getProperty('type').type).toBe('literal');
    expect(s.getProperty('type').literalValue).toBe('a');

    expect(s.getProperty('type2').type).toBe('literal');
    expect(s.getProperty('type2').literalValue).toBe(2);

    expect(s.getProperty('type3').type).toBe('literal');
    expect(s.getProperty('type3').literalValue).toBe(false);
});

test('literal string', () => {
    const s = t.schema({
        type: t.literal('a'),
    });

    // {
    //     const item = jsonSerializer.for(s).deserialize({type: 'a'});
    //     expect(item.type).toBe('a');
    // }

    // {
    //     const item = jsonSerializer.for(s).deserialize({type: 'ff'});
    //     expect(item.type).toBe('a');
    // }

    // {
    //     const item = jsonSerializer.for(s).deserialize({});
    //     expect(item.type).toBe('a');
    // }

    // {
    //     const item = jsonSerializer.for(s).deserialize({ type: undefined });
    //     expect(item.type).toBe('a');
    // }

    {
        const item = jsonSerializer.for(s).deserialize({ type: null });
        expect(item.type).toBe('a');
    }

    validate(s, { type: 'd' });
});
