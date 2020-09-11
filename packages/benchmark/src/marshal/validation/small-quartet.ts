import {validate} from '@super-hornet/marshal';
import {BenchSuite} from '@super-hornet/core';
import {good} from './validation';
//we use `e` and not `v` because Marshal supports out of the box error explanations, which quartet does only with `e`.
import {e} from 'quartet';

const QuartetModelChecker = e<any>({
    number: e.number,
    negNumber: e.and(e.number, e.negative),
    maxNumber: e.number,
    strings: e.arrayOf(e.string),
    longString: e.and(e.string, e.minLength(100)),
    boolean: e.boolean,
});

export async function main() {
    const suite = new BenchSuite('quartet');

    suite.add('validate', () => {
        QuartetModelChecker(good);
    });

    suite.run();
}
