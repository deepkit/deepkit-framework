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

export function findQuerySatisfied<T extends { [index: string]: any }>(target: T, query: FilterQuery<T>): boolean {
    //get rid of "Excessive stack depth comparing types 'any' and 'SiftQuery<T[]>'."
    //sift can not be correctly imported, so we need to work around it.
    return (sift as any).default(query as any, [target] as any[]).length > 0;
}

export function normalizeDirectory(path: string): string {
    if (path[0] !== '/') path = '/' + path;
    if (path[path.length] !== '/') path = path + '/';
    return path;
}

declare var v8debug: any;

export function inDebugMode() {
    return typeof v8debug === 'object' || /--debug|--inspect/.test(process.execArgv.join(' '));
}
