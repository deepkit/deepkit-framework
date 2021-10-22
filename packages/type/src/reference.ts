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

export function isReference(obj: any): boolean {
    return isObject(obj) && referenceSymbol in obj;
}

export function getReferenceInfo<T>(obj: T): ReferenceInfo<T> | undefined {
    return (obj as any)[referenceSymbol] as ReferenceInfo<T>;
}

export function getReferenceItemInfo<T>(obj: T): ReferenceItemInfo<T> | undefined {
    return (obj as any)[referenceItemSymbol] as ReferenceItemInfo<T>;
}

export function getOrCreateReferenceItemInfo<T>(obj: T): ReferenceItemInfo<T> {
    if (!(obj as any)[referenceItemSymbol]) (obj as any)[referenceItemSymbol] = {hydrated: false};
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
    hydrated: boolean,
}

export const referenceSymbol = Symbol('reference');
export const referenceItemSymbol = Symbol('reference/item');

export function createReference<T>(referenceClass: ClassType<T>, pk: { [name: string]: any }) {
    const args: any[] = [];
    //
    // const classSchema = getClassSchema(referenceClass);
    //
    // if (!(referenceSymbol in referenceClass.prototype)) {
    //     referenceClass = createReferenceClass(classSchema);
    // }
    //
    // for (const prop of classSchema.getMethodProperties('constructor')) {
    //     args.push(pk[prop.name]);
    // }
    //
    // const old = getGlobalStore().unpopulatedCheck;
    // getGlobalStore().unpopulatedCheck = UnpopulatedCheck.None;
    //
    // try {
    //     const ref = new referenceClass(...args);
    //     Object.assign(ref, pk);
    //
    //
    //     return ref;
    // } finally {
    //     getGlobalStore().unpopulatedCheck = old;
    // }

}
export function createReferenceClass<T>(
    classType: ClassType,
): ClassType<T> {
    // const type = classSchema.classType as any;
    //
    // if (classSchema.data.referenceClass) return classSchema.data.referenceClass;

    const Reference = class extends classType {
    };

    // Object.defineProperty(Reference.prototype, referenceSymbol, { value: { hydrator: undefined }, enumerable: false });
    // Object.defineProperty(Reference.prototype, referenceItemSymbol, { value: null, writable: true, enumerable: false });
    // Object.defineProperty(Reference.prototype, classSchemaSymbol, { writable: true, enumerable: false, value: classSchema });
    //
    // Reference.buildId = classSchema.buildId;
    //
    // const globalStore = getGlobalStore();
    //
    // Object.defineProperty(Reference, 'name', {
    //     value: classSchema.getClassName() + 'Reference'
    // });
    //
    // classSchema.data.referenceClass = Reference;
    //
    // for (const property of classSchema.getProperties()) {
    //     if (property.isId) continue;
    //
    //     const message = property.isReference || property.backReference ?
    //         `Reference ${classSchema.getClassName()}.${property.name} was not loaded. Use joinWith(), useJoinWith(), etc to populate the reference.`
    //         :
    //         `Can not access ${classSchema.getClassName()}.${property.name} since class was not completely hydrated. Use 'await hydrate(item)' to completely load it.`;
    //
    //     Object.defineProperty(Reference.prototype, property.name, {
    //         enumerable: false,
    //         configurable: true,
    //         get() {
    //             if (this.hasOwnProperty(property.symbol)) {
    //                 return this[property.symbol];
    //             }
    //
    //             if (globalStore.unpopulatedCheck === UnpopulatedCheck.Throw) {
    //                 throw new Error(message);
    //             }
    //
    //             if (globalStore.unpopulatedCheck === UnpopulatedCheck.ReturnSymbol) {
    //                 return unpopulatedSymbol;
    //             }
    //         },
    //         set(v) {
    //             if (globalStore.unpopulatedCheck === UnpopulatedCheck.None) {
    //                 //when this check is off, this item is being constructed
    //                 //so we ignore initial set operations
    //                 return;
    //             }
    //
    //             // when we set value, we just accept it and treat all
    //             // properties accessors that don't throw the Error above as "updated"
    //             Object.defineProperty(this, property.symbol, {
    //                 enumerable: false,
    //                 writable: true,
    //                 value: v
    //             });
    //         }
    //     });
    // }

    return Reference as ClassType<T>;
}
