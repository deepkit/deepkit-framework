/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { ClassType, isObject } from '@deepkit/core';

import { UnpopulatedCheck, typeSettings, unpopulatedSymbol } from './core.js';
import { ReflectionClass, reflectionClassSymbol } from './reflection/reflection.js';
import { ReflectionKind, Type } from './reflection/type.js';

export function isReferenceInstance(obj: any): boolean {
    return isObject(obj) && referenceSymbol in obj;
}

export function getReferenceInfo<T>(obj: T): ReferenceInfo<T> | undefined {
    return (obj as any)[referenceSymbol] as ReferenceInfo<T>;
}

export function getReferenceItemInfo<T>(obj: T): ReferenceItemInfo<T> | undefined {
    return (obj as any)[referenceItemSymbol] as ReferenceItemInfo<T>;
}

export function getOrCreateReferenceItemInfo<T>(obj: T): ReferenceItemInfo<T> {
    if (!(obj as any)[referenceItemSymbol]) (obj as any)[referenceItemSymbol] = { hydrated: false };
    return (obj as any)[referenceItemSymbol] as ReferenceItemInfo<T>;
}

export function isReferenceHydrated(obj: any): boolean {
    if (!(referenceItemSymbol in obj)) return false;
    const info = getReferenceItemInfo(obj);
    return info ? info.hydrated : false;
}

export function markAsHydrated(item: any) {
    getOrCreateReferenceItemInfo(item).hydrated = true;
}

export interface ReferenceInfo<T> {
    hydrator?: (item: T) => Promise<void>;
}

export interface ReferenceItemInfo<T> {
    hydrated: boolean;
}

export const referenceSymbol = Symbol('reference');
export const referenceItemSymbol = Symbol('reference/item');

export function createReference<T>(type: ClassType<T> | Type | ReflectionClass<any>, pk: { [name: string]: any }): T {
    const reflection = ReflectionClass.from(type);

    const reflectionClass = createReferenceClass(reflection);

    const old = typeSettings.unpopulatedCheck;
    typeSettings.unpopulatedCheck = UnpopulatedCheck.None;

    try {
        return Object.assign(Object.create(reflectionClass.prototype), pk);
    } finally {
        typeSettings.unpopulatedCheck = old;
    }
}

export function createReferenceClass<T>(reflection: ReflectionClass<any>): ClassType<T> {
    if (reflection.data.referenceClass) return reflection.data.referenceClass;

    const Reference =
        reflection.type.kind === ReflectionKind.class ? class extends reflection.type.classType {} : class {};

    Object.defineProperty(Reference.prototype, referenceSymbol, { value: { hydrator: undefined }, enumerable: false });
    Object.defineProperty(Reference.prototype, referenceItemSymbol, { value: null, writable: true, enumerable: false });
    Object.defineProperty(Reference.prototype, reflectionClassSymbol, {
        writable: true,
        enumerable: false,
        value: reflection,
    });

    Object.defineProperty(Reference, 'name', {
        value: reflection.getClassName() + 'Reference',
    });

    reflection.data.referenceClass = Reference;

    for (const property of reflection.getProperties()) {
        if (property.isPrimaryKey()) continue;

        // we can not exclude default or optional properties, since we tell serializer/validator/change-detector with
        // returning `unpopulatedSymbol` that this property is not loaded. Returning the wrong default/undefined leads to wrong results.

        const name = String(property.getName());

        const message =
            property.isReference() || property.isBackReference()
                ? `Reference ${reflection.getClassName()}.${name} was not loaded. Use joinWith(), useJoinWith(), etc to populate the reference.`
                : `Can not access ${reflection.getClassName()}.${name} since class was not completely hydrated. Use 'await hydrateEntity(${reflection.getClassName()})' to completely load it.`;

        Object.defineProperty(Reference.prototype, property.name, {
            enumerable: true,
            configurable: true,
            get() {
                if (this.hasOwnProperty(property.symbol)) {
                    return this[property.symbol];
                }

                if (typeSettings.unpopulatedCheck === UnpopulatedCheck.Throw) {
                    throw new Error(message);
                }

                if (typeSettings.unpopulatedCheck === UnpopulatedCheck.ReturnSymbol) {
                    return unpopulatedSymbol;
                }
            },
            set(v) {
                if (typeSettings.unpopulatedCheck === UnpopulatedCheck.None) {
                    //when this check is off, this item is being constructed so we ignore initial set operations
                    return;
                }

                // when we set value, we just accept it and treat all
                // properties accessors that don't throw the Error above as "updated"
                Object.defineProperty(this, property.symbol, {
                    enumerable: false,
                    writable: true,
                    value: v,
                });
            },
        });
    }

    return Reference as ClassType<T>;
}
