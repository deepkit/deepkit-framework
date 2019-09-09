import 'jest';
import 'reflect-metadata';
import {classToPlain, EnumField, Exclude, Field, plainToClass} from "../core";
import {plainToClass as classTransformerPlainToClass, classToPlain as classTransformerClassToPlain, Exclude as ctExclude, Transform, Type} from "class-transformer";
import {bench} from "./util";
import {Plan, SubModel} from "@marcj/marshal/tests/entities";

export class SimpleModel {
    @Field()
    name: string;

    @Field()
    type: number = 0;

    @Field()
    yesNo: boolean = false;

    @EnumField(Plan)
    plan: Plan = Plan.DEFAULT;

    @Field()
    created: Date = new Date;

    @Field([String])
    types: string[] = [];

    @Field([SubModel])
    children: SubModel[] = [];

    @Field({SubModel})
    childrenMap: { [key: string]: SubModel } = {};

    notMapped: { [key: string]: any } = {};

    @Field().exclude()
    excluded: string = 'default';

    @Field().exclude('plain')
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
    bench('Marshal: 10000x plainToClass Big Entity', () => {
        for (let i = 0; i < 10000; i++) {
            plainToClass(SimpleModel, {
                name: 'name' + i,
                type: 2,
                plan: Plan.ENTERPRISE,
                children: {label: 'label'},
                childrenMap: {'sub': {label: 'label'}},
                types: ['a', 'b', 'c']
            });
        }
    });

    bench('ClassTransformer: 10000x plainToClass Big Entity', () => {
        for (let i = 0; i < 10000; i++) {
            classTransformerPlainToClass(ClassTransformerSimpleModel, {
                name: 'name' + i,
                type: 2,
                plan: Plan.ENTERPRISE,
                children: {label: 'label'},
                childrenMap: {'sub': {label: 'label'}},
                types: ['a', 'b', 'c']
            });
        }
    });
});

test('benchmark classToPlain', () => {
    bench('Marshal: 10000x classToPlain Big Entity', () => {
        const item = new SimpleModel('name');
        item.type = 2;
        item.plan = Plan.ENTERPRISE;
        item.children.push(new SubModel('sub'));
        item.childrenMap['sub'] = new SubModel('sub');
        item.types = ['a', 'b', 'c'];

        for (let i = 0; i < 10000; i++) {
            item.name = 'item_' + i;
            classToPlain(SimpleModel, item);
        }
    });

    bench('ClassTransformer: 10000x classToPlain Big Entity', () => {
        const item = new ClassTransformerSimpleModel();
        item.type = 2;
        item.plan = Plan.ENTERPRISE;
        item.children.push(new SubModel('sub'));
        item.childrenMap['sub'] = new SubModel('sub');
        item.types = ['a', 'b', 'c'];

        for (let i = 0; i < 10000; i++) {
            classTransformerClassToPlain(item);
        }
    });
});
