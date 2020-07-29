import {
    Entity,
    t,
    uuid,
    MultiIndex
} from '@super-hornet/marshal';

export class JobTaskQueue {
    @t
    position: number = 0;

    @t
    tries: number = 0;

    @t
    result: string = '';

    @t
    added: Date = new Date();
}


@Entity('sub')
export class SubModel {
    @t
    label: string;

    @t.optional
    age?: number;

    @t.optional
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
    constructor(
        @t.array(SubModel).decorated.name('items')
        public items: SubModel[]) {
    }

    public add(item: SubModel) {
        this.items.push(item);
    }
}

export class StringCollectionWrapper {
    constructor(
        @t.array(String).decorated.name('items')
        public items: string[]
    ) {
    }

    public add(item: string) {
        this.items.push(item);
    }
}

@Entity('SimpleModel')
@MultiIndex(['name', 'type'], {unique: true})
export class SimpleModel {
    @t.primary.uuid
    id: string = uuid();

    @t.index()
    name: string;

    @t
    type: number = 0;

    @t
    yesNo: boolean = false;

    @t.enum(Plan)
    plan: Plan = Plan.DEFAULT;

    @t
    created: Date = now;

    @t.array(String)
    types: string[] = [];

    @t.optional
    child?: SubModel;

    @t.optional
    selfChild?: SimpleModel;

    @t.array(SubModel)
    children: SubModel[] = [];

    @t.map(SubModel)
    childrenMap: { [key: string]: SubModel } = {};

    @t.type(CollectionWrapper)
    childrenCollection: CollectionWrapper = new CollectionWrapper([]);

    @t.type(StringCollectionWrapper)
    stringChildrenCollection: StringCollectionWrapper = new StringCollectionWrapper([]);

    notMapped: { [key: string]: any } = {};

    @t.any
    anyField: any;

    @t.exclude()
    excluded: string = 'default';

    @t.exclude('mongo')
    excludedForMongo: string = 'excludedForMongo';

    @t.exclude('plain')
    excludedForPlain: string = 'excludedForPlain';

    constructor(name: string) {
        this.name = name;
    }
}

@Entity('SuperSimple')
export class SuperSimple {
    @t.primary.mongoId
    _id?: string;

    @t
    name?: string;
}

@Entity('BaseClass')
export class BaseClass {
    @t.primary.mongoId
    _id?: string;
}


@Entity('ChildClass')
export class ChildClass extends BaseClass {
    @t
    name?: string;
}
