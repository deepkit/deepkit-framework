/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType, isObject } from '@deepkit/core';
import { ClassSchema, classSchemaSymbol, getGlobalStore, UnpopulatedCheck, unpopulatedSymbol } from './model';

export function isReference(obj: any): boolean {
    return isObject(obj) && referenceSymbol in obj;
}

export const referenceSymbol = Symbol('reference');

export function createReferenceClass<T>(
    classSchema: ClassSchema<T>,
): ClassType<T> {
    const type = classSchema.classType as any;

    const Reference = class extends type {
    };

    Object.defineProperty(Reference.prototype, referenceSymbol, { value: true });
    Object.defineProperty(Reference.prototype, classSchemaSymbol, { writable: true, enumerable: false, value: classSchema });

    Reference.buildId = classSchema.buildId;

    const globalStore = getGlobalStore();

    Object.defineProperty(Reference, 'name', {
        value: classSchema.getClassName() + 'Reference'
    });

    for (const property of classSchema.getProperties()) {
        if (property.isId) continue;

        const message = property.isReference || property.backReference ?
            `Reference ${classSchema.getClassName()}.${property.name} was not loaded. Use joinWith(), useJoinWith(), etc to populate the reference.`
            :
            `Can not access ${classSchema.getClassName()}.${property.name} since class was not completely hydrated. Use 'await hydrate(item)' to completely load it.`;

        Object.defineProperty(Reference.prototype, property.name, {
            enumerable: false,
            configurable: true,
            get() {
                if (this.hasOwnProperty(property.symbol)) {
                    return this[property.symbol];
                }

                if (globalStore.unpopulatedCheck === UnpopulatedCheck.Throw) {
                    throw new Error(message);
                }

                if (globalStore.unpopulatedCheck === UnpopulatedCheck.ReturnSymbol) {
                    return unpopulatedSymbol;
                }
            },
            set(v) {
                if (globalStore.unpopulatedCheck === UnpopulatedCheck.None) {
                    //when this check is off, this item is being constructed
                    //so we ignore initial set operations
                    return;
                }

                // when we set value, we just accept it and treat all
                // properties accessors that don't throw the Error above as "updated"
                Object.defineProperty(this, property.symbol, {
                    enumerable: false,
                    writable: true,
                    value: v
                });
            }
        });
    }

    return Reference as ClassType<T>;
}
