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
import { assertType, createReference, getPrimaryKeyHashGenerator, ReflectionClass, ReflectionKind } from '@deepkit/type';
import { IdentityMap } from './identity-map';

export function getReference<T>(
    reflectionClass: ReflectionClass<T>,
    pk: { [name: string]: any },
    identityMap?: IdentityMap,
    pool?: Map<string, T>,
    ReferenceClass?: ClassType
): T {
    let pkHash = '';
    if (identityMap || pool) {
        pkHash = getPrimaryKeyHashGenerator(reflectionClass)(pk);
        if (pool) {
            const item = pool.get(pkHash);
            if (item) return item;
        }
        if (identityMap) {
            const item = identityMap.getByHash(reflectionClass, pkHash);
            if (item) return item as T;
        }
    }

    assertType(reflectionClass.type, ReflectionKind.class);
    const ref = createReference(ReferenceClass || reflectionClass.type.classType, pk);
    if (pool) pool.set(pkHash, ref);
    if (identityMap) identityMap.store(reflectionClass, ref);
    return ref;
}
