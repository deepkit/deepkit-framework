import 'reflect-metadata';
import { expect, test } from '@jest/globals';
import { t } from '../src/decorators';
import { jsonSerializer } from '../src/json-serializer';
import { getClassSchema } from '../src/model';
import { getConverterForSnapshot, getPrimaryKeyExtractor, getPrimaryKeyHashGenerator } from '../src/snapshot';

class Image {
    @t title: string = '';

    constructor(@t.primary public id: number = 0) {
    }
}

class User {
    @t.reference().optional image?: Image;

    @t title: string = '';

    constructor(@t.primary public id: number = 0) {

    }
}

test('benchmark', () => {
});

test('getJITConverterForSnapshot', () => {
    const schema = getClassSchema(User);
    const converter = getConverterForSnapshot(schema);

    {
        const converted = converter({ id: 22, title: 'Peter' });
        expect(converted).toBeInstanceOf(Object);
        expect(converted).toEqual({ id: 22, title: 'Peter', image: null });
    }

    {
        const converted = converter({ id: 22, title: 'Peter', image: new Image(3) });
        expect(converted).toBeInstanceOf(Object);
        expect(converted).toEqual({ id: 22, title: 'Peter', image: { id: 3 } });
    }
});


test('getPrimaryKeyExtractor', () => {
    const schema = getClassSchema(User);
    const converter = getPrimaryKeyExtractor(schema);

    {
        const converted = converter({ id: 22, title: 'Peter' });
        expect(converted).toBeInstanceOf(Object);
        expect(converted).toEqual({ id: 22 });
    }

    {
        const converted = converter({ id: 22, title: 'Peter', image: new Image(3) });
        expect(converted).toBeInstanceOf(Object);
        expect(converted).toEqual({ id: 22 });
    }
});

test('getPrimaryKeyHashGenerator', () => {
    const schema = getClassSchema(User);
    expect(schema.getPrimaryFields().length).toBe(1);
    const converter = getPrimaryKeyHashGenerator(schema, jsonSerializer);

    {
        const converted = converter({ id: 22, title: 'Peter' });
        expect(converted).toBe('\u000022');
    }

    {
        const converted = converter({ id: 22, title: 'Peter', image: new Image(3) });
        expect(converted).toBe('\u000022');
    }
});
