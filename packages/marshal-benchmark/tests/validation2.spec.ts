import 'jest';
import 'reflect-metadata';
import {plainToClassFactory, t as tMarshal, validatesFactory} from '@super-hornet/marshal';
import {BenchSuite} from '@super-hornet/core';
import * as t from 'io-ts';
import * as G from 'io-ts/lib/Guard';


//this is copied from https://github.com/gcanti/io-ts/blob/master/perf/typescript-runtime-type-benchmarks.ts
/*
io-TS:
decode x 1,138,915 ops/sec ±0.44% (87 runs sampled)
is x 1,975,690 ops/sec ±0.44% (91 runs sampled)


 */
const decoderMarshal = tMarshal.schema({
    number: tMarshal.number,
    negNumber: tMarshal.number,
    maxNumber: tMarshal.number,
    string: tMarshal.string,
    longString: tMarshal.string,
    boolean: tMarshal.boolean,
    deeplyNested: tMarshal.type({
        foo: tMarshal.string,
        num: tMarshal.number,
        bool: tMarshal.boolean
    })
});

export const good = {
    number: 1,
    negNumber: -1,
    maxNumber: Number.MAX_VALUE,
    string: 'string',
    longString:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Vivendum intellegat et qui, ei denique consequuntur vix. Semper aeterno percipit ut his, sea ex utinam referrentur repudiandae. No epicuri hendrerit consetetur sit, sit dicta adipiscing ex, in facete detracto deterruisset duo. Quot populo ad qui. Sit fugit nostrum et. Ad per diam dicant interesset, lorem iusto sensibus ut sed. No dicam aperiam vis. Pri posse graeco definitiones cu, id eam populo quaestio adipiscing, usu quod malorum te. Ex nam agam veri, dicunt efficiantur ad qui, ad legere adversarium sit. Commune platonem mel id, brute adipiscing duo an. Vivendum intellegat et qui, ei denique consequuntur vix. Offendit eleifend moderatius ex vix, quem odio mazim et qui, purto expetendis cotidieque quo cu, veri persius vituperata ei nec. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
    boolean: true,
    deeplyNested: {
        foo: 'bar',
        num: 1,
        bool: false
    }
};


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

test('test speed vs io-ts', () => {
    const suite = new BenchSuite('Marshal vs io-ts');

    const guard = validatesFactory(decoderMarshal);
    expect(guard(good)).toBe(true);

    suite.add('marshal guard', () => {
        guard(good);
    });

    const decode = plainToClassFactory(decoderMarshal);
    suite.add('marshal decode', () => {
        decode(good);
    });

    suite.add('io-ts guard', () => {
        guardIoTS.is(good);
    });

    suite.add('io-ts decode', () => {
        decoderIoTS.decode(good);
    });

    suite.run();
});