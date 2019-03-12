import {
    ArrayType,
    BooleanType,
    Class,
    ClassArray,
    ClassMap,
    DateType,
    Decorator,
    Entity,
    EnumType,
    Exclude,
    ExcludeToMongo,
    ExcludeToPlain,
    ID,
    Index,
    MongoIdType,
    NumberType,
    StringType,
    uuid,
    UUIDType
} from '..';

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
    public items: SubModel[];

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
    @ID()
    @UUIDType()
    id: string = uuid();

    @StringType()
    @Index()
    name: string;

    @NumberType()
    type: number = 0;

    @BooleanType()
    yesNo: boolean = false;

    @EnumType(Plan)
    plan: Plan = Plan.DEFAULT;

    @DateType()
    created: Date = now;

    @ArrayType()
    @StringType()
    types: string[] = [];

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
    _id?: string;

    @StringType()
    name?: string;
}

@Entity('BaseClass')
export class BaseClass {
    @ID()
    @MongoIdType()
    _id?: string;
}


@Entity('ChildClass')
export class ChildClass extends BaseClass {
    @StringType()
    name?: string;
}

