import {
    Entity,
    f,
    uuid,
    MultiIndex
} from '../index';

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

    @f.optional()
    age?: number;

    @f.type(JobTaskQueue).optional()
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

export const now = new Date();

export class CollectionWrapper {
    @f.array(SubModel).decorated()
    public items: SubModel[];

    constructor(items: SubModel[]) {
        this.items = items;
    }

    public add(item: SubModel) {
        this.items.push(item);
    }
}

export class StringCollectionWrapper {
    @f.array(String).decorated()
    public items: string[];

    constructor(items: string[]) {
        this.items = items;
    }

    public add(item: string) {
        this.items.push(item);
    }
}

@Entity('SimpleModel')
@MultiIndex(['name', 'type'], {unique: true})
export class SimpleModel {
    @f.id().uuid()
    id: string = uuid();

    @f.index()
    name: string;

    @f
    type: number = 0;

    @f
    yesNo: boolean = false;

    @f.enum(Plan)
    plan: Plan = Plan.DEFAULT;

    @f
    created: Date = now;

    @f.array(String)
    types: string[] = [];

    @f.optional()
    child?: SubModel;

    @f.optional()
    selfChild?: SimpleModel;

    @f.array(SubModel)
    children: SubModel[] = [];

    @f.map(SubModel)
    childrenMap: { [key: string]: SubModel } = {};

    @f.type(CollectionWrapper)
    childrenCollection: CollectionWrapper = new CollectionWrapper([]);

    @f.type(StringCollectionWrapper)
    stringChildrenCollection: StringCollectionWrapper = new StringCollectionWrapper([]);

    notMapped: { [key: string]: any } = {};

    @f.any()
    anyField: any;

    @f.exclude()
    excluded: string = 'default';

    @f.exclude('mongo')
    excludedForMongo: string = 'excludedForMongo';

    @f.exclude('plain')
    excludedForPlain: string = 'excludedForPlain';

    constructor(name: string) {
        this.name = name;
    }
}

@Entity('SuperSimple')
export class SuperSimple {
    @f.id().mongoId()
    _id?: string;

    @f
    name?: string;
}

@Entity('BaseClass')
export class BaseClass {
    @f.id().mongoId()
    _id?: string;
}


@Entity('ChildClass')
export class ChildClass extends BaseClass {
    @f
    name?: string;
}
