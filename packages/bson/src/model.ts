/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

let PROCESS_UNIQUE: Uint8Array | undefined = undefined;

function getUnique(): Uint8Array {
    if (PROCESS_UNIQUE) return PROCESS_UNIQUE;
    PROCESS_UNIQUE = crypto.getRandomValues(new Uint8Array(5));
    return PROCESS_UNIQUE;
}

/**
 * Lookup table for hex conversion (1-byte → 2 hex chars).
 * @internal
 */
export const hexTable: string[] = [];
for (let i = 0; i < 256; i++) {
    hexTable[i] = (i <= 15 ? '0' : '') + i.toString(16);
}

/**
 * Lookup table for hex conversion (2-byte → 4 hex chars).
 * Halves the number of string concatenations for UUID/MongoId.
 * @internal
 */
export const hexTable2: string[] = new Array(65536);
for (let i = 0; i < 65536; i++) {
    hexTable2[i] = hexTable[i >> 8] + hexTable[i & 0xff];
}

/**
 * Lookup table for hex char to number conversion.
 */
const hexCharToNumber: number[] = new Array(128).fill(-1);
for (let i = 0; i <= 9; i++) hexCharToNumber[48 + i] = i; // '0'-'9'
for (let i = 0; i <= 5; i++) hexCharToNumber[97 + i] = 10 + i; // 'a'-'f'
for (let i = 0; i <= 5; i++) hexCharToNumber[65 + i] = 10 + i; // 'A'-'F'

/**
 * Convert a hex byte (2 characters) to a number.
 * @internal
 * @param hex The hex string
 * @param offset Byte offset in the hex string (each byte = 2 characters)
 */
export function hexToByte(hex: string, offset: number = 0): number {
    const pos = offset * 2;
    const hi = hexCharToNumber[hex.charCodeAt(pos)];
    const lo = hexCharToNumber[hex.charCodeAt(pos + 1)];
    return (hi << 4) | lo;
}

/**
 * Convert a UUID string to a byte at a given position.
 * UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (36 chars with dashes)
 * This function handles the dash positions correctly.
 * @internal
 */
export function uuidStringToByte(uuid: string, offset: number): number {
    // Map byte offset to character position, accounting for dashes
    // Dashes are at positions 8, 13, 18, 23
    let charPos = offset * 2;
    if (offset >= 4) charPos++; // After first dash
    if (offset >= 6) charPos++; // After second dash
    if (offset >= 8) charPos++; // After third dash
    if (offset >= 10) charPos++; // After fourth dash

    const hi = hexCharToNumber[uuid.charCodeAt(charPos)];
    const lo = hexCharToNumber[uuid.charCodeAt(charPos + 1)];
    return (hi << 4) | lo;
}

/**
 * Thin wrapper around the native type to allow serializing it correctly
 * in types like any.
 */
export class ObjectId {
    static index: number = Math.ceil(Math.random() * 0xffffff);

    /**
     * Generate a new ObjectId hex string.
     * @param time Optional timestamp in seconds (defaults to current time)
     */
    static generate(time?: number): string {
        if (!time) time = Math.ceil(Date.now() / 1000);
        const inc = ++ObjectId.index % 0xffffff;

        const processUnique = getUnique();

        return (
            '' +
            hexTable[(time >> 24) & 0xff] +
            hexTable[(time >> 16) & 0xff] +
            hexTable[(time >> 8) & 0xff] +
            hexTable[time & 0xff] +
            hexTable[processUnique[0]] +
            hexTable[processUnique[1]] +
            hexTable[processUnique[2]] +
            hexTable[processUnique[3]] +
            hexTable[processUnique[4]] +
            hexTable[(inc >> 16) & 0xff] +
            hexTable[(inc >> 8) & 0xff] +
            hexTable[inc & 0xff]
        );
    }
}
