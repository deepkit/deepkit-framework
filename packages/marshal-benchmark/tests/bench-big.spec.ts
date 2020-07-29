import 'jest-extended';
import 'reflect-metadata';
import {
    classToPlain as classTransformerClassToPlain,
    Exclude as ctExclude,
    plainToClass as classTransformerPlainToClass,
    Transform,
    Type
} from "class-transformer";
import {bench, BenchSuite} from "@super-hornet/core";
import {classToPlain, Entity, f, plainToClass} from "@super-hornet/marshal";

export class JobTaskQueue {
    @f
    position: number = 0;

    @f
    tries: number = 0;

    @f
    result: string = '';

    @f
    added: Date = new Date();
}


@Entity('sub')
export class SubModel {
    @f
    label: string;

    @f.optional
    age?: number;

    @f.optional
    queue?: JobTaskQueue;

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

export class SimpleModel {
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

export class ClassTransformerSimpleModel {
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


test('benchmark big plainToClass', () => {
    const suite = new BenchSuite('plainToClass big model', 100_000);

    suite.add('Marshal', (i) => {
        plainToClass(SimpleModel, {
            name: 'name' + i,
            type: 2,
            plan: Plan.ENTERPRISE,
            children: {label: 'label'},
            childrenMap: {'sub': {label: 'label'}},
            types: ['a', 'b', 'c']
        });
    });

    suite.add('ClassTransformer', (i) => {
        classTransformerPlainToClass(ClassTransformerSimpleModel, {
            name: 'name' + i,
            type: 2,
            plan: Plan.ENTERPRISE,
            children: {label: 'label'},
            childrenMap: {'sub': {label: 'label'}},
            types: ['a', 'b', 'c']
        });
    });

    suite.run();
});

test('benchmark big classToPlain', () => {
    const suite = new BenchSuite('classToPlain big model', 100_000);

    {
        const item = new SimpleModel('name');
        item.type = 2;
        item.plan = Plan.ENTERPRISE;
        item.children.push(new SubModel('sub'));
        item.childrenMap['sub'] = new SubModel('sub');
        item.types = ['a', 'b', 'c'];

        suite.add('Marshal: jitClassToPlain Big Entity', (i) => {
            item.name = 'item_' + i;
            classToPlain(SimpleModel, item);
        });
    }

    {
        const item = new ClassTransformerSimpleModel();
        item.type = 2;
        item.plan = Plan.ENTERPRISE;
        item.children.push(new SubModel('sub'));
        item.childrenMap['sub'] = new SubModel('sub');
        item.types = ['a', 'b', 'c'];
        suite.add('ClassTransformer: classToPlain Big Entity', (i) => {
            classTransformerClassToPlain(item);
        });
    }

    suite.run();
});
