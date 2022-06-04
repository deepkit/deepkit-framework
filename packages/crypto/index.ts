/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

function createBuffer(size: number): Uint8Array {
    try {
        return Buffer.alloc(size);
    } catch {}

    return new Uint8Array(size);
}

function insecureRandomBytes(size: number): Uint8Array {
    const result = createBuffer(size);
    for (let i = 0; i < size; ++i) result[i] = Math.floor(Math.random() * 256);
    return result;
}

declare let window: any;
declare let require: Function;

let randomBytesImpl: (size: number) => Uint8Array = insecureRandomBytes;

if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    randomBytesImpl = (size) =>
        window.crypto.getRandomValues(createBuffer(size));
} else {
    try {
        randomBytesImpl = require('crypto').randomBytes;
    } catch {
        // keep the fallback
    }
}

if (!randomBytesImpl) randomBytesImpl = insecureRandomBytes;

export const randomBytes = randomBytesImpl;
