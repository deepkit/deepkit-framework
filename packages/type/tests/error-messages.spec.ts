import { test } from 'node:test';

import { expect } from '@deepkit/run/expect';

import { ReflectionClass, resolveReceiveType, typeOf } from '../src/reflection/reflection.js';
import { NoTypeReceived } from '../src/utils.js';

/**
 * Regression tests for issue #562: Improved NoTypeReceived error messages
 *
 * These tests verify that typeOf<T>() and ReflectionClass.from<T>() throw
 * helpful NoTypeReceived errors with diagnostic information when called
 * without type parameters.
 */

test('typeOf() without type parameter throws helpful NoTypeReceived error', () => {
    // Should throw NoTypeReceived error class
    expect(() => typeOf()).toThrow(NoTypeReceived);

    // Should contain the specific context about what function was called
    expect(() => typeOf()).toThrow('typeOf<T>() called without type parameter');

    // Should contain the helpful diagnostic sections
    expect(() => typeOf()).toThrow('Common causes:');
    expect(() => typeOf()).toThrow('How to fix:');

    // Should contain specific help for common issues
    expect(() => typeOf()).toThrow('@deepkit/type-compiler');
    expect(() => typeOf()).toThrow('tsconfig.json');
});

test('ReflectionClass.from() without type parameter throws helpful NoTypeReceived error', () => {
    // Should throw NoTypeReceived error class
    expect(() => ReflectionClass.from()).toThrow(NoTypeReceived);

    // Should contain the specific context about what function was called
    expect(() => ReflectionClass.from()).toThrow('ReflectionClass.from() called without argument');

    // Should contain the helpful diagnostic sections
    expect(() => ReflectionClass.from()).toThrow('Common causes:');
    expect(() => ReflectionClass.from()).toThrow('How to fix:');

    // Should contain specific help for common issues
    expect(() => ReflectionClass.from()).toThrow('@deepkit/type-compiler');
    expect(() => ReflectionClass.from()).toThrow('tsconfig.json');
});

test('NoTypeReceived error message contains documentation link', () => {
    // Both errors should include a link to documentation
    expect(() => typeOf()).toThrow('https://deepkit.io/documentation/runtime-types');
    expect(() => ReflectionClass.from()).toThrow('https://deepkit.io/documentation/runtime-types');
});

test('resolveReceiveType() with undefined throws NoTypeReceived error', () => {
    // Should throw NoTypeReceived error class when called with undefined
    expect(() => resolveReceiveType(undefined)).toThrow(NoTypeReceived);

    // Should contain the specific context about what function was called
    expect(() => resolveReceiveType(undefined)).toThrow('resolveReceiveType called with undefined type');

    // Should contain the helpful diagnostic sections
    expect(() => resolveReceiveType(undefined)).toThrow('Common causes:');
    expect(() => resolveReceiveType(undefined)).toThrow('How to fix:');
});
