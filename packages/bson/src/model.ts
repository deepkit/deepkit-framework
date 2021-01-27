/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import * as crypto from "@deepkit/crypto";
const { randomBytes } = crypto;

let PROCESS_UNIQUE: Uint8Array | undefined = undefined;

function getUnique(): Uint8Array {
    if (PROCESS_UNIQUE) return PROCESS_UNIQUE;
    PROCESS_UNIQUE = randomBytes(5);
    return PROCESS_UNIQUE;
}

export const hexTable: string[] = [];
for (let i = 0; i < 256; i++) {
    hexTable[i] = (i <= 15 ? '0' : '') + i.toString(16);
}

export const ObjectIdSymbol = Symbol.for('deepkit/bson/objectid');
export const UUIDSymbol = Symbol.for('deepkit/bson/uuid');

export function isUUID(v: any): v is UUID {
    return !!v && v.hasOwnProperty(UUIDSymbol);
}

export function isObjectId(v: any): v is ObjectId {
    return !!v && v.hasOwnProperty(ObjectIdSymbol);
}

/**
 * Thin wrapper around the native type to allow to serialize it correctly
 * in types like t.any.
*/
export class ObjectId {
    static index: number = Math.ceil(Math.random() & 0xffffff);

    [ObjectIdSymbol] = true;

    constructor(public id: string) { }

    static generate(time?: number): string {
        if (!time) time = Math.ceil(Date.now() / 1000);
        const inc = (++ObjectId.index) % 0xffffff;

        const processUnique = getUnique();

        return ''
            + hexTable[(time >> 24) & 0xff]
            + hexTable[(time >> 16) & 0xff]
            + hexTable[(time >> 8) & 0xff]
            + hexTable[time & 0xff]

            + hexTable[processUnique[0]]
            + hexTable[processUnique[1]]
            + hexTable[processUnique[2]]
            + hexTable[processUnique[3]]
            + hexTable[processUnique[4]]

            + hexTable[(inc >> 16) & 0xff]
            + hexTable[(inc >> 8) & 0xff]
            + hexTable[inc & 0xff]
            ;
    }
}

/**
 * Thin wrapper around the native type to allow to serialize it correctly
 * in types like t.any.
*/
export class UUID {
    [UUIDSymbol] = true;

    constructor(public id: string) { }
}
