import {validate} from '@deepkit/marshal';
import {BenchSuite} from '@deepkit/core';
import * as t from 'io-ts';
import * as G from 'io-ts/lib/Guard';
import {isRight} from 'fp-ts/Either';
import {good} from './validation';

const decoderIoTS = t.type({
    number: t.number,
    negNumber: t.number,
    maxNumber: t.number,
    string: t.string,
    longString: t.string,
    boolean: t.boolean,
    deeplyNested: t.type({
        foo: t.string,
        num: t.number,
        bool: t.boolean
    })
})

const guardIoTS = G.type({
    number: G.number,
    negNumber: G.number,
    maxNumber: G.number,
    string: G.string,
    longString: G.string,
    boolean: G.boolean,
    deeplyNested: G.type({
        foo: G.string,
        num: G.number,
        bool: G.boolean
    })
})

export async function main() {
    const suite = new BenchSuite('io-ts');

    suite.add('validate', () => {
        isRight(decoderIoTS.decode(good));
    });

    suite.add('validate-no-errors', () => {
        guardIoTS.is(good);
    });

    suite.run();
}
