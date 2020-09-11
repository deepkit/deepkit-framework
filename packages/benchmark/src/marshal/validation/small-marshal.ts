import {t, validate, validateFactory} from '@super-hornet/marshal';
import {BenchSuite} from '@super-hornet/core';
import {good} from './validation';

const Model = t.schema({
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
});
const ModelValidator = validateFactory(Model);

export async function main() {
    const suite = new BenchSuite('marshal');

    suite.add('validate', () => {
        ModelValidator(good);
    });

    suite.run();
}
