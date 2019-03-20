import {
    Decorated,
    Entity,
    EnumField,
    Exclude,
    ExcludeToMongo,
    ExcludeToPlain,
    Field, FieldAny,
    IDField,
    Index,
    MongoIdField, Optional,
    uuid,
    UUIDField
} from '../index';

@Entity('sub')
export class SubModel {
    @Field()
    label: string;

    @Field()
    @Optional()
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
@Index({unique: true}, ['name', 'type'])
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

    @Field([SubModel])
    children: SubModel[] = [];

    @Field({SubModel})
    childrenMap: {[key: string]: SubModel} = {};

    @Field(CollectionWrapper)
    childrenCollection: CollectionWrapper = new CollectionWrapper([]);

    @Field(StringCollectionWrapper)
    stringChildrenCollection: StringCollectionWrapper = new StringCollectionWrapper([]);

    notMapped: {[key: string]: any} = {};

    @FieldAny()
    anyField: any;

    @Exclude()
    @Field()
    excluded: string = 'default';

    @ExcludeToMongo()
    @Field()
    excludedForMongo: string = 'excludedForMongo';

    @ExcludeToPlain()
    @Field()
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

