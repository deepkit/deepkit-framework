import {BenchSuite} from '@deepkit/core';
import {getClassSchema, plainSerializer, t} from '@deepkit/type';
import {getJITConverterForSnapshot, getPrimaryKeyExtractor, getPrimaryKeyHashGenerator} from '@deepkit/orm';

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

export async function main() {

    const suite = new BenchSuite('converter');

    const schema = getClassSchema(User);

    const item = {id: 22, title: 'Peter', image: new Image(3)};

    suite.add('primaryKeyExtractor-getter', () => {
        getPrimaryKeyExtractor(schema);
    });

    suite.add('converterForSnapshot-getter', () => {
        getJITConverterForSnapshot(schema);
    });

    suite.add('primaryKeyHashGenerator-getter', () => {
        getPrimaryKeyHashGenerator(schema, plainSerializer);
    });

    suite.add('primaryKeyExtractor', () => {
        const converted = getPrimaryKeyExtractor(schema)(item);
    });

    suite.add('converterForSnapshot', () => {
        const converted = getJITConverterForSnapshot(schema)(item);
    });

    suite.add('primaryKeyHashGenerator', () => {
        const converted = getPrimaryKeyHashGenerator(schema, plainSerializer)(item);
    });

    const hash = getPrimaryKeyHashGenerator(schema, plainSerializer);
    suite.add('primaryKeyHashGenerator-saved', () => {
        const converted = hash(item);
    });

    const snap = getJITConverterForSnapshot(schema);
    suite.add('converterForSnapshot-saved', () => {
        const converted = snap(item);
    });

    var _value = item;
    suite.add('primaryKeyHashGenerator-ref', () => {
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
}