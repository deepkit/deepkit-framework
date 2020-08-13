import {ClassSchema, getClassSchema, getClassTypeFromInstance, JitPropertyConverter} from "@super-hornet/marshal";
import {Entity} from "./query";
import {PrimaryKey} from "./identity-map";

export type FlattenIfArray<T> = T extends Array<any> ? T[0] : T;
export type FieldName<T> = keyof T & string;

export function getClassSchemaInstancePairs<T extends Entity>(items: Iterable<T>): Map<ClassSchema<any>, T[]> {
    const map = new Map<ClassSchema<any>, T[]>();

    for (const item of items) {
        const classSchema = getClassSchema(getClassTypeFromInstance(item));
        let items = map.get(classSchema);
        if (!items) {
            items = [];
            map.set(classSchema, items);
        }
        items.push(item);
    }

    return map;
}

export function convertPrimaryKeyToClass<T>(classSchema: ClassSchema<T>, serializerSourceName: string, dbItem: any): PrimaryKey<T> {
    const jitConverter = new JitPropertyConverter(classSchema, serializerSourceName, 'class');
    const pk: any = {};
    for (const primaryKey of classSchema.getPrimaryFields()) {
        pk[primaryKey.name] = jitConverter.convert(primaryKey.name, dbItem[primaryKey.name]);
    }
    return pk;
}