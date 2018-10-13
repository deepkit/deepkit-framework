import {DateType, Entity, EnumType, ID, NumberType, StringType, ClassArray, ClassMap, UUIDType, uuid} from "../";

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

    constructor(name: string) {
        this.name = name;
    }
}

