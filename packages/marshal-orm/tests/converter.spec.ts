import 'jest-extended';
import 'reflect-metadata';
import {getJITConverterForSnapshot, getPrimaryKeyExtractor, getPrimaryKeyHashGenerator} from '../index';
import {t, getClassSchema} from '@super-hornet/marshal';
import { bench } from '@super-hornet/core';

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

test('getJITConverterForSnapshot', () => {
    const schema = getClassSchema(User);
    const converter = getJITConverterForSnapshot(schema);

    {
        const converted = converter({id: 22, title: 'Peter'});
        expect(converted).toBeObject();
        expect(converted).toEqual({id: 22, title: 'Peter'});
    }

    {
        const converted = converter({id: 22, title: 'Peter', image: new Image(3)});
        expect(converted).toBeObject();
        expect(converted).toEqual({id: 22, title: 'Peter', image: {id: 3}});
    }

    bench(100_000, 'snapshot simple', () => {
        const converted = getJITConverterForSnapshot(schema)({id: 22, title: 'Peter', image: new Image(3)});
    });
});


test('getPrimaryKeyExtractor', () => {
    const schema = getClassSchema(User);
    const converter = getPrimaryKeyExtractor(schema);

    {
        const converted = converter({id: 22, title: 'Peter'});
        expect(converted).toBeObject();
        expect(converted).toEqual({id: 22});
    }

    {
        const converted = converter({id: 22, title: 'Peter', image: new Image(3)});
        expect(converted).toBeObject();
        expect(converted).toEqual({id: 22});
    }

    bench(100_000, 'primary key extractor simple', () => {
        const converted = getPrimaryKeyExtractor(schema)({id: 22, title: 'Peter', image: new Image(3)});
    });
});

test('getPrimaryKeyHashGenerator', () => {
    const schema = getClassSchema(User);
    expect(schema.getPrimaryFields().length).toBe(1);
    const converter = getPrimaryKeyHashGenerator(schema);

    {
        const converted = converter({id: 22, title: 'Peter'});
        expect(converted).toBe(',22');
    }

    {
        const converted = converter({id: 22, title: 'Peter', image: new Image(3)});
        expect(converted).toBe(',22');
    }

    bench(100_000, 'snapshot simple', () => {
        const converted = getPrimaryKeyHashGenerator(schema)({id: 22, title: 'Peter', image: new Image(3)});
    });
});
