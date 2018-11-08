import {
    DateType,
    Entity,
    EnumType,
    ID,
    NumberType,
    StringType,
    ClassArray,
    ClassMap,
    UUIDType,
    uuid,
    Exclude,
    MongoIdType,
    Decorator,
    Class, ExcludeToMongo, ExcludeToPlain, ArrayType
} from "../";

@Entity('sub')
export class SubModel {
    @StringType()
    label: string;

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
    @ClassArray(SubModel)
    @Decorator()
    public items;

    constructor(items: SubModel[]) {
        this.items = items;
    }

    public add(item: SubModel) {
        this.items.push(item);
    }
}

export class StringCollectionWrapper {
    @Decorator()
    @StringType()
    @ArrayType()
    public items;

    constructor(items: string[]) {
        this.items = items;
    }

    public add(item: string) {
        this.items.push(item);
    }
}

@Entity('SimpleModel')
export class SimpleModel {
    @ID()
    @UUIDType()
    id: string = uuid();

    @StringType()
    name: string;

    @NumberType()
    type: number = 0;

    @EnumType(Plan)
    plan: Plan = Plan.DEFAULT;

    @DateType()
    created: Date = now;

    @ClassArray(SubModel)
    children: SubModel[] = [];

    @ClassMap(SubModel)
    childrenMap: {[key: string]: SubModel} = {};

    @Class(CollectionWrapper)
    childrenCollection: CollectionWrapper = new CollectionWrapper([]);

    @Class(StringCollectionWrapper)
    stringChildrenCollection: StringCollectionWrapper = new StringCollectionWrapper([]);

    notMapped: {[key: string]: any} = {};

    @Exclude()
    @StringType()
    excluded: string = 'default';

    @ExcludeToMongo()
    @StringType()
    excludedForMongo: string = 'excludedForMongo';

    @ExcludeToPlain()
    @StringType()
    excludedForPlain: string = 'excludedForPlain';

    constructor(name: string) {
        this.name = name;
    }
}

@Entity('SuperSimple')
export class SuperSimple {
    @ID()
    @MongoIdType()
    _id: string;

    @StringType()
    name: string;
}

@Entity('BaseClass')
export class BaseClass {
    @ID()
    @MongoIdType()
    _id: string;
}


@Entity('ChildClass')
export class ChildClass extends BaseClass {
    @StringType()
    name: string;
}

