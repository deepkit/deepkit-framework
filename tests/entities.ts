import {
    Decorated,
    Entity,
    EnumField,
    Field,
    FieldAny,
    IDField,
    Index,
    MongoIdField,
    Optional,
    uuid,
    UUIDField,
    MultiIndex
} from '../index';

export class JobTaskQueue {
    @Field()
    position: number = 0;

    @Field()
    tries: number = 0;

    @Field()
    result: string = '';

    @Field()
    added: Date = new Date();
}


@Entity('sub')
export class SubModel {
    @Field()
    label: string;

    @Field()
    @Optional()
    age?: number;

    @Field(JobTaskQueue)
    @Optional()
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
    @Field([SubModel])
    @Decorated()
    public items: SubModel[];

    constructor(items: SubModel[]) {
        this.items = items;
    }

    public add(item: SubModel) {
        this.items.push(item);
    }
}

export class StringCollectionWrapper {
    @Decorated()
    @Field([String])
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
    @IDField()
    @UUIDField()
    id: string = uuid();

    @Field()
    @Index()
    name: string;

    @Field()
    type: number = 0;

    @Field()
    yesNo: boolean = false;

    @EnumField(Plan)
    plan: Plan = Plan.DEFAULT;

    @Field()
    created: Date = now;

    @Field([String])
    types: string[] = [];

    @Field()
    @Optional()
    child?: SubModel;

    @Field()
    @Optional()
    selfChild?: SimpleModel;

    @Field([SubModel])
    children: SubModel[] = [];

    @Field({SubModel})
    childrenMap: { [key: string]: SubModel } = {};

    @Field(CollectionWrapper)
    childrenCollection: CollectionWrapper = new CollectionWrapper([]);

    @Field(StringCollectionWrapper)
    stringChildrenCollection: StringCollectionWrapper = new StringCollectionWrapper([]);

    notMapped: { [key: string]: any } = {};

    @FieldAny()
    anyField: any;

    @Field().exclude()
    excluded: string = 'default';

    @Field().exclude('mongo')
    excludedForMongo: string = 'excludedForMongo';

    @Field().exclude('plain')
    excludedForPlain: string = 'excludedForPlain';

    constructor(name: string) {
        this.name = name;
    }
}

@Entity('SuperSimple')
export class SuperSimple {
    @IDField()
    @MongoIdField()
    _id?: string;

    @Field()
    name?: string;
}

@Entity('BaseClass')
export class BaseClass {
    @IDField()
    @MongoIdField()
    _id?: string;
}


@Entity('ChildClass')
export class ChildClass extends BaseClass {
    @Field()
    name?: string;
}
