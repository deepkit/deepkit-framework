import 'jest';
import 'reflect-metadata';
import {f, validatesFactory} from '@super-hornet/marshal';
import {BenchSuite} from '@super-hornet/core';

export const Data = Object.freeze({
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
        bool: false,
    },
});

class DeeplyNestedType {
    @f
    foo!: string;

    @f
    num!: number;

    @f
    bool!: boolean;
}

class DataType {
    @f
    number!: number;

    @f
    negNumber!: number;

    @f
    maxNumber!: number;

    @f
    string!: string;

    @f
    longString!: string;

    @f
    boolean!: boolean;

    @f.type(DeeplyNestedType)
    deeplyNested!: DeeplyNestedType;
}

const checkData = validatesFactory(DataType);

test('Marshal runtime check', () => {
    const suite = new BenchSuite('Marshal runtime check');
    checkData(Data);
    suite.add('marshal guard', () => {
        checkData(Data);
    });

    suite.run();
});