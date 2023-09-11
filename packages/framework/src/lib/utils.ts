/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import sift from 'sift';
import { FilterQuery } from '@deepkit/rpc';

//todo: move to live-database
export function findQuerySatisfied<T extends { [index: string]: any }>(target: T, query: FilterQuery<T>): boolean {
    //get rid of "Excessive stack depth comparing types 'any' and 'SiftQuery<T[]>'."
    return (sift as any)(query as any, [target] as any[]).length > 0;
}

export function normalizeDirectory(path: string): string {
    if (path[0] !== '/') path = '/' + path;
    if (path[path.length - 1] !== '/') path = path + '/';
    return path;
}
