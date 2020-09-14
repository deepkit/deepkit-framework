import {BenchSuite} from '@deepkit/core';
import {classToPlain, Exclude as ctExclude, plainToClass, Transform, Type} from 'class-transformer';

export class SubModel {
    label: string;

    age?: number;

    constructorUsed = false;

    constructor(label: string) {
        this.label = label;
        this.constructorUsed = true;
    }
}

export enum Plan {
    DEFAULT,
    PRO,
    ENTERPRISE,
}

export class Model {
    name?: string;
    type: number = 0;
    yesNo: boolean = false;

    @Transform(v => Plan[v])
    plan: Plan = Plan.DEFAULT;

    @Type(() => Date)
    created: Date = new Date;

    types: string[] = [];

    @Type(() => SubModel)
    children: SubModel[] = [];

    @Type(() => SubModel)
    childrenMap: { [key: string]: SubModel } = {};

    @ctExclude()
    notMapped: { [key: string]: any } = {};

    anyField: any;

    @ctExclude()
    excluded: string = 'default';

    @ctExclude({toPlainOnly: true})
    excludedForPlain: string = 'excludedForPlain';
}

export async function main() {
    const suite = new BenchSuite('class-transformer');
    const plain = {
        name: 'name',
        type: 2,
        plan: Plan.ENTERPRISE,
        children: [{label: 'label'}],
        childrenMap: {'sub': {label: 'label'}},
        types: ['a', 'b', 'c']
    };

    suite.add('deserialize', () => {
        plainToClass(Model, plain);
    });

    const item = plainToClass(Model, plain);
    suite.add('serialize', () => {
        classToPlain(item);
    });

    suite.run();
}
