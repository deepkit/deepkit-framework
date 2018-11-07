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
    ObjectIdType
} from "../";

@Entity('sub')
export class SubModel {
    @StringType()
    label: string;

    constructor(label: string) {
        this.label = label;
    }
}

export enum Plan {
    DEFAULT,
    PRO,
    ENTERPRISE,
}

export const now = new Date();

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

    notMapped: {[key: string]: any} = {};

    @Exclude()
    excluded: string = 'default';

    @Exclude('mongo')
    excludedForMongo: string = 'excludedForMongo';

    @Exclude('plain')
    excludedForPlain: string = 'excludedForPlain';

    constructor(name: string) {
        this.name = name;
    }
}

@Entity('SuperSimple')
export class SuperSimple {
    @ID()
    @ObjectIdType()
    _id: string;

    @StringType()
    name: string;
}