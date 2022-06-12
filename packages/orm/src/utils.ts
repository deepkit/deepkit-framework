/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { Changes, ReflectionClass } from '@deepkit/type';
import { OrmEntity } from './type';
import sift from 'sift';
import { FilterQuery } from './query';
import { getInstanceStateFromItem } from './identity-map';
import { getClassTypeFromInstance } from '@deepkit/core';

export type FlattenIfArray<T> = T extends Array<any> ? T[0] : T;
export type FieldName<T> = keyof T & string;

export function getClassSchemaInstancePairs<T extends OrmEntity>(items: Iterable<T>): Map<ReflectionClass<any>, T[]> {
    const map = new Map<ReflectionClass<any>, T[]>();

    for (const item of items) {
        const classSchema = ReflectionClass.from(getClassTypeFromInstance(item));
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
export type Resolve<T extends { _: Placeholder<any> }> = ReturnType<T['_']>;
export type Replace<T, R> = T & { _: Placeholder<R> };

export function buildChangesFromInstance<T extends object>(item: T): Changes<T> {
    const state = getInstanceStateFromItem(item);
    const lastSnapshot = state.getSnapshot();
    const currentSnapshot = state.classState.snapshot(item);
    return state.classState.changeDetector(lastSnapshot, currentSnapshot, item) || new Changes;
}
