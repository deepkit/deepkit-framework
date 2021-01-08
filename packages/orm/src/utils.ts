/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import {ClassSchema, getClassSchema, getClassTypeFromInstance} from '@deepkit/type';
import {Entity} from './type';
import sift from 'sift';
import { FilterQuery } from './query';

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
    //sift can not be correctly imported, so we need to work around it.
    return (sift as any).default(query as any, [target] as any[]).length > 0;
}

export function findQueryList<T extends { [index: string]: any }>(items: T[], query: FilterQuery<T>): T[] {
    //get rid of "Excessive stack depth comparing types 'any' and 'SiftQuery<T[]>'."
    //sift can not be correctly imported, so we need to work around it.
    return (sift as any).default(query as any, items as any[]);
}