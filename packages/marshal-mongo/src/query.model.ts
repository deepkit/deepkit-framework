import {DatabaseQueryModel, Entity, SORT_ORDER} from "@super-hornet/marshal-orm";

export type FilterQuery<T> = Partial<T> | {
    [P in keyof T]?: T[P] | Query<T[P]>;
} | Query<T>;

export type Query<T> = {
    $eq?: T;
    $ne?: T;
    $or?: Array<FilterQuery<T>>;
    $gt?: T;
    $gte?: T;
    $lt?: T;
    $lte?: T;
    $mod?: number[];
    $in?: Array<T>;
    $nin?: Array<T>;
    $not?: FilterQuery<T>;
    $type?: any;
    $all?: Array<Partial<T>>;
    $size?: number;
    $nor?: Array<FilterQuery<T>>;
    $and?: Array<FilterQuery<T>>;
    $regex?: RegExp | string;
    $exists?: boolean;
    $options?: "i" | "g" | "m" | "u";

    //special Marshal type
    $parameter?: string;
};

export type SORT_TYPE = SORT_ORDER | { $meta: "textScore" };
export type DEEP_SORT<T extends Entity> = { [P in keyof T]?: SORT_TYPE } & { [P: string]: SORT_TYPE };

export class MongoQueryModel<T extends Entity> extends DatabaseQueryModel<T, Partial<T> & FilterQuery<T>, DEEP_SORT<T>> {
}
