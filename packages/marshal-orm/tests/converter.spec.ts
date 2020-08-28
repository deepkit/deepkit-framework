import 'jest-extended';
import 'reflect-metadata';
import {getJITConverterForSnapshot, getPrimaryKeyExtractor, getPrimaryKeyHashGenerator} from '../index';
import {t, getClassSchema} from '@super-hornet/marshal';
import {bench, BenchSuite} from '@super-hornet/core';

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
    const suite = new BenchSuite('Converter');

    const schema = getClassSchema(User);

    const item = {id: 22, title: 'Peter', image: new Image(3)};

    suite.add('getPrimaryKeyExtractor getter', () => {
        getPrimaryKeyExtractor(schema);
    });

    suite.add('getJITConverterForSnapshot getter', () => {
        getJITConverterForSnapshot(schema);
    });

    suite.add('getPrimaryKeyHashGenerator getter', () => {
        getPrimaryKeyHashGenerator(schema);
    });

    suite.add('getPrimaryKeyExtractor', () => {
        const converted = getPrimaryKeyExtractor(schema)(item);
    });

    suite.add('getJITConverterForSnapshot', () => {
        const converted = getJITConverterForSnapshot(schema)(item);
    });

    suite.add('getPrimaryKeyHashGenerator', () => {
        const converted = getPrimaryKeyHashGenerator(schema)(item);
    });

    const hash = getPrimaryKeyHashGenerator(schema);
    suite.add('getPrimaryKeyHashGenerator saved', () => {
        const converted = hash(item);
    });

    const snap = getJITConverterForSnapshot(schema);
    suite.add('getJITConverterForSnapshot saved', () => {
        const converted = snap(item);
    });

    var _value = item;
    suite.add('getPrimaryKeyHashGenerator ref', () => {
        var _result = '';
        var lastValue;

        //getPrimaryKeyHashGenerator id class:plain:number
        lastValue = '';

        if (_value.id === undefined) {


        } else if (_value.id === null) {


        } else {
            lastValue = _value.id;
        }

        _result += ' ' + lastValue;
        _result;
    });

    suite.run();
});

test('getJITConverterForSnapshot', () => {
    const schema = getClassSchema(User);
    const converter = getJITConverterForSnapshot(schema);

    {
        const converted = converter({id: 22, title: 'Peter'});
        expect(converted).toBeObject();
        expect(converted).toEqual({id: 22, title: 'Peter', image: null});
    }

    {
        const converted = converter({id: 22, title: 'Peter', image: new Image(3)});
        expect(converted).toBeObject();
        expect(converted).toEqual({id: 22, title: 'Peter', image: {id: 3}});
    }
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
});

test('getPrimaryKeyHashGenerator', () => {
    const schema = getClassSchema(User);
    expect(schema.getPrimaryFields().length).toBe(1);
    const converter = getPrimaryKeyHashGenerator(schema);

    {
        const converted = converter({id: 22, title: 'Peter'});
        expect(converted).toBe('\u000022');
    }

    {
        const converted = converter({id: 22, title: 'Peter', image: new Image(3)});
        expect(converted).toBe('\u000022');
    }
});
