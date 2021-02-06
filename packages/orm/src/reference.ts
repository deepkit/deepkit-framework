/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType } from '@deepkit/core';
import { ClassSchema, createReferenceClass, getGlobalStore, getPrimaryKeyHashGenerator, jsonSerializer, UnpopulatedCheck } from '@deepkit/type';
import { IdentityMap } from './identity-map';

export function getReference<T>(
    classSchema: ClassSchema<T>,
    pk: {[name: string]: any},
    identityMap?: IdentityMap,
    pool?: Map<string, T>,
    ReferenceClass?: ClassType
): T {
    let pkHash = '';
    if (identityMap || pool) {
        pkHash = getPrimaryKeyHashGenerator(classSchema, jsonSerializer)(pk);
        if (pool) {
            const item = pool.get(pkHash);
            if (item) return item;
        }
        if (identityMap) {
            const item = identityMap.getByHash(classSchema, pkHash);
            if (item) return item;
        }
    }

    const args: any[] = [];

    for (const prop of classSchema.getMethodProperties('constructor')) {
        args.push(pk[prop.name]);
    }

    const old = getGlobalStore().unpopulatedCheck;
    getGlobalStore().unpopulatedCheck = UnpopulatedCheck.None;

    try {
        ReferenceClass = ReferenceClass ?? createReferenceClass(classSchema);

        const ref = new ReferenceClass(...args);
        Object.assign(ref, pk);


        if (pool) pool.set(pkHash, ref);
        if (identityMap) identityMap.store(classSchema, ref);

        return ref;
    } finally {
        getGlobalStore().unpopulatedCheck = old;
    }
}
