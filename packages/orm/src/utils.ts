/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { Changes, ClassSchema, getClassSchema, getClassTypeFromInstance } from '@deepkit/type';
import { Entity } from './type';
import sift from 'sift';
import { FilterQuery } from './query';
import { getInstanceStateFromItem } from './identity-map';

export type FlattenIfArray<T> = T extends Array<any> ? T[0] : T;
export type FieldName<T> = keyof T & string;

export function getClassSchemaInstancePairs<T extends Entity>(items: Iterable<T>): Map<ClassSchema, T[]> {
    const map = new Map<ClassSchema, T[]>();

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


export function findQuerySatisfied<T extends { [index: string]: any }>(target: T, query: FilterQuery<T>): boolean {
    //get rid of "Excessive stack depth comparing types 'any' and 'SiftQuery<T[]>'."
    return (sift as any)(query as any, [target] as any[]).length > 0;
}

export function findQueryList<T extends { [index: string]: any }>(items: T[], query: FilterQuery<T>): T[] {
    //get rid of "Excessive stack depth comparing types 'any' and 'SiftQuery<T[]>'."
    return (sift as any)(query as any, items as any[]);
}

export type Placeholder<T> = () => T;
export type Resolve<T extends {_: Placeholder<any>}> = ReturnType<T['_']>;
export type Replace<T, R> = T & { _: Placeholder<R> };

export function buildChangesFromInstance<T>(item: T): Changes<T> {
    const state = getInstanceStateFromItem(item);
    const lastSnapshot = state.getSnapshot();
    const currentSnapshot = state.classState.snapshot(item);
    console.log(item, state.classState.classSchema.getClassName(), state.item === item, lastSnapshot, currentSnapshot)
    return state.classState.changeDetector(lastSnapshot, currentSnapshot, item) || new Changes;
}
