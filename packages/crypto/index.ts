/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

function insecureRandomBytes(size: number): Uint8Array {
    const result = Buffer.alloc(size);
    for (let i = 0; i < size; ++i) result[i] = Math.floor(Math.random() * 256);
    return result;
}

declare let window: any;
declare let require: Function;

export let randomBytes: (size: number) => Uint8Array = insecureRandomBytes;

if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    randomBytes = size => window.crypto.getRandomValues(Buffer.alloc(size));
} else {
    try {
        randomBytes = require('crypto').randomBytes;
    } catch (e) {
        // keep the fallback
    }

    if (!randomBytes) randomBytes = insecureRandomBytes;
}
