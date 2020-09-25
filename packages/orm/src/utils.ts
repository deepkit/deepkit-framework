import {ClassSchema, getClassSchema, getClassTypeFromInstance} from '@deepkit/type';
import {Entity} from './type';

export type FlattenIfArray<T> = T extends Array<any> ? T[0] : T;
export type FieldName<T> = keyof T & string;

export type Relations<T> = { [P in keyof T]: T[P] extends object ? T[P] : (T[P] extends Array<infer U> ? U extends object ? T[P] : never : never) };
export type RelationName<T> = keyof Relations<T> & string;

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
