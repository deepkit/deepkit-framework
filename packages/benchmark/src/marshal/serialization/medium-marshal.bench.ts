import {Entity, f, plainSerializer} from '@deepkit/marshal';
import {BenchSuite} from '@deepkit/core';


@Entity('sub')
export class SubModel {
    @f
    label: string;

    @f.optional
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
    @f
    name: string;

    @f
    type: number = 0;

    @f
    yesNo: boolean = false;

    @f.enum(Plan)
    plan: Plan = Plan.DEFAULT;

    @f
    created: Date = new Date;

    @f.array(String)
    types: string[] = [];

    @f.array(SubModel)
    children: SubModel[] = [];

    @f.map(SubModel)
    childrenMap: { [key: string]: SubModel } = {};

    notMapped: { [key: string]: any } = {};

    @f.exclude()
    excluded: string = 'default';

    @f.exclude('plain')
    excludedForPlain: string = 'excludedForPlain';

    constructor(name: string) {
        this.name = name;
    }
}
const ModelSerializer = plainSerializer.for(Model);

export async function main() {
    const suite = new BenchSuite('marshal');
    const plain = {
        name: 'name',
        type: 2,
        plan: Plan.ENTERPRISE,
        children: [{label: 'label'}],
        childrenMap: {'sub': {label: 'label'}},
        types: ['a', 'b', 'c']
    };

    suite.add('deserialize', () => {
        ModelSerializer.deserialize(plain);
    });

    const item = plainSerializer.for(Model).deserialize(plain);
    suite.add('serialize', () => {
        ModelSerializer.serialize(item);
    });

    suite.run();
}
