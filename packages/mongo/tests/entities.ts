import { Embedded, entity, Excluded, Index, MongoId, PrimaryKey, UUID, uuid } from '@deepkit/type';

export class JobTaskQueue {
    position: number = 0;
    tries: number = 0;
    result: string = '';
    added: Date = new Date();
}

@entity.name('sub')
export class SubModel {
    label: string;
    age?: number;
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
    constructor(public items: SubModel[]) {
    }

    public add(item: SubModel) {
        this.items.push(item);
    }
}

export class StringCollectionWrapper {
    constructor(public items: string[]) {
    }

    public add(item: string) {
        this.items.push(item);
    }
}

@(entity.name('SimpleModel').index(['name', 'type'], { unique: true }))
export class SimpleModel {
    id: UUID & PrimaryKey = uuid();

    type: number = 0;
    yesNo: boolean = false;

    plan: Plan = Plan.DEFAULT;

    created: Date = now;

    types: string[] = [];

    child?: SubModel;

    selfChild?: SimpleModel;

    children: SubModel[] = [];

    childrenMap: { [key: string]: SubModel } = {};

    childrenCollection: Embedded<CollectionWrapper> = new CollectionWrapper([]);

    stringChildrenCollection: Embedded<StringCollectionWrapper> = new StringCollectionWrapper([]);

    notMapped: { [key: string]: any } = {};

    anyField: any;

    excluded: string & Excluded = 'default';

    excludedForMongo: string & Excluded<'mongo'> = 'excludedForMongo';

    excludedForPlain: string & Excluded<'json'> = 'excludedForPlain';

    constructor(public name: string & Index) {
    }
}

@entity.name('SuperSimple')
export class SuperSimple {
    //what is the default for mongoId on new objects?
    _id: MongoId & PrimaryKey = '';

    constructor(public name?: string) {
    }
}

@entity.name('BaseClass')
export class BaseClass {
    _id: MongoId & PrimaryKey = '';
}


@entity.name('ChildClass')
export class ChildClass extends BaseClass {
    name?: string;
}
