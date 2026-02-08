/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { stringify, v4 } from 'uuid';

/**
 * Generates a detailed error message for missing runtime type information.
 * This helps users understand what went wrong and how to fix it.
 */
export function createRuntimeTypeError(context?: string): string {
    const contextLine = context ? `\n\nContext: ${context}` : '';
    return `No type information received.${contextLine}

This error occurs when @deepkit/type cannot find runtime type information for a type.

Common causes:
  1. @deepkit/type-compiler is not installed or not configured correctly
  2. TypeScript's "reflection" option is not enabled in tsconfig.json
  3. Circular imports preventing type resolution
  4. Type imported from a file/package without type compilation
  5. Using a type that was declared with "declare" keyword

How to fix:
  1. Install the type compiler: npm install @deepkit/type-compiler
  2. Run: npx deepkit-type-install (patches TypeScript for reflection)
  3. Add to tsconfig.json: { "compilerOptions": { "reflection": true } }
  4. If using a bundler (Vite, webpack, etc.), ensure the transformer is configured
  5. Check for circular imports between files

For more information, see: https://deepkit.io/documentation/runtime-types`;
}

export class NoTypeReceived extends Error {
    constructor(context?: string) {
        super(createRuntimeTypeError(context));
    }
}

/**
 * Returns a new UUID v4 as string.
 */
export function uuid(): string {
    return v4();
}

/**
 * Writes a new uuid v4 into an existing buffer, and returns the same buffer.
 */
export function writeUuid(buffer: Uint8Array, offset: number = 0): Uint8Array {
    v4(undefined, buffer, offset);
    return buffer;
}

/**
 * Stringify an exising Uint8Array buffer.
 */
export function stringifyUuid(buffer: Uint8Array, offset: number = 0): string {
    return stringify(buffer, offset);
}

/**
 * URL-safe alphabet for nanoid.
 * Contains: A-Z, a-z, 0-9, _, -
 */
const nanoidAlphabet = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict';

/**
 * Returns a new NanoId as string.
 * Default size is 21 characters.
 *
 * Uses crypto.getRandomValues for secure random generation.
 */
export function nanoid(size: number = 21): string {
    const bytes = crypto.getRandomValues(new Uint8Array(size));
    let id = '';
    for (let i = 0; i < size; i++) {
        id += nanoidAlphabet[bytes[i] & 63];
    }
    return id;
}

export type Binary =
    | ArrayBuffer
    | Uint8Array
    | Int8Array
    | Uint8ClampedArray
    | Uint16Array
    | Int16Array
    | Uint32Array
    | Int32Array
    | Float32Array
    | Float64Array;

export type JSONPartial<T> = T extends Date
    ? string
    : T extends Array<infer K>
      ? Array<JSONPartial<K>>
      : // T extends TypedArrays ? string :
        T extends Binary
        ? string
        : T extends object
          ? JSONPartialObject<T>
          : T extends string
            ? number | T
            : T extends boolean
              ? number | string | T
              : T extends bigint
                ? number | string | T
                : T extends number
                  ? bigint | string | T
                  : T;

export type JSONPartialObject<T> = { [name in keyof T]?: T[name] | null };

export type JSONSingle<T> = T extends Date
    ? string | Date
    : T extends Array<infer K>
      ? Array<JSONSingle<K>>
      : T extends Binary
        ? string
        : T extends object
          ? JSONEntity<T>
          : T extends string
            ? string | number | boolean | undefined
            : T extends boolean
              ? T | number | string
              : T extends number
                ? T | string
                : T;
export type JSONEntity<T> = { [name in keyof T]: JSONSingle<T[name]> };

export function regExpFromString(v: string): RegExp {
    if (v[0] === '/') {
        const end = v.lastIndexOf('/');
        const regexp = v.slice(1, end);
        const modifiers = v.slice(1 + end);
        return new RegExp(regexp, modifiers);
    }
    return new RegExp(v);
}
