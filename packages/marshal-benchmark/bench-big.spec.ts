import 'jest-extended';
import 'reflect-metadata';
import {
    classToPlain as classTransformerClassToPlain,
    Exclude as ctExclude,
    plainToClass as classTransformerPlainToClass,
    Transform,
    Type
} from "class-transformer";
import {bench} from "./util";
import {Plan, SubModel} from "@super-hornet/marshal/tests/entities";
import {jitClassToPlain, jitPlainToClass} from "@super-hornet/marshal";
import {f} from "@super-hornet/marshal";

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


test('benchmark plainToClass', () => {
    bench(10000, 'Marshal: jitPlainToClass Big Entity', (i) => {
        jitPlainToClass(SimpleModel, {
            name: 'name' + i,
            type: 2,
            plan: Plan.ENTERPRISE,
            children: {label: 'label'},
            childrenMap: {'sub': {label: 'label'}},
            types: ['a', 'b', 'c']
        });
    });

    bench(10000, 'ClassTransformer: plainToClass Big Entity', (i) => {
        classTransformerPlainToClass(ClassTransformerSimpleModel, {
            name: 'name' + i,
            type: 2,
            plan: Plan.ENTERPRISE,
            children: {label: 'label'},
            childrenMap: {'sub': {label: 'label'}},
            types: ['a', 'b', 'c']
        });
    });
});

test('benchmark classToPlain', () => {
    {
        const item = new SimpleModel('name');
        item.type = 2;
        item.plan = Plan.ENTERPRISE;
        item.children.push(new SubModel('sub'));
        item.childrenMap['sub'] = new SubModel('sub');
        item.types = ['a', 'b', 'c'];

        bench(10000, 'Marshal: jitClassToPlain Big Entity', (i) => {
            item.name = 'item_' + i;
            jitClassToPlain(SimpleModel, item);
        });
    }

    {
        const item = new ClassTransformerSimpleModel();
        item.type = 2;
        item.plan = Plan.ENTERPRISE;
        item.children.push(new SubModel('sub'));
        item.childrenMap['sub'] = new SubModel('sub');
        item.types = ['a', 'b', 'c'];
        bench(10000, 'ClassTransformer: classToPlain Big Entity', (i) => {
            classTransformerClassToPlain(item);
        });
    }
});
