/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import {ClassType} from '@deepkit/core';
import {ClassSchema, UnpopulatedCheck} from './model';

export interface GlobalStore {
    RegisteredEntities: { [name: string]: ClassType | ClassSchema };
    unpopulatedCheck: UnpopulatedCheck;
    /**
     * Per default, @deepkit/types tries to detect forward-ref by checking the type in the metadata or given in @t.type(x) to be a function.
     * If so, we treat it as a forwardRef. This does not work for ES5 fake-classes, since everything there is a function.
     * Disable this feature flag to support IE11.
     */
    enableForwardRefDetection: boolean;
}

function getGlobal(): any {
    if ('undefined' !== typeof globalThis) return globalThis;
    if ('undefined' !== typeof window) return window;
    throw Error('No global');
}

export function getGlobalStore(): GlobalStore {
    const global = getGlobal();
    if (!global.DeepkitStore) {
        global.DeepkitStore = {
            RegisteredEntities: {},
            unpopulatedCheck: UnpopulatedCheck.Throw,
            enableForwardRefDetection: true,
        } as GlobalStore;
    }

    return global.DeepkitStore;
}
