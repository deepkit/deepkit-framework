/*
 * Deepkit Framework
 * Copyright Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

/**
 * Tests for external library type graceful degradation (issue #555).
 *
 * When Deepkit encounters classes from external libraries that were not compiled
 * with @deepkit/type-compiler (i.e., they don't have __type metadata), it should
 * return a graceful TypeAny with the class name preserved instead of throwing.
 *
 * This enables better DI error messages and allows partial type information
 * for external dependencies.
 */
import { test } from 'node:test';

import { expect } from '@deepkit/run/expect';

import { resolveRuntimeType } from '../src/reflection/processor.js';
import { reflect, reflectOrUndefined, typeOf } from '../src/reflection/reflection.js';
import { ReflectionKind, Type, TypeAny } from '../src/reflection/type.js';

/**
 * Simulates an external library class without __type metadata.
 * In real scenarios, this would be a class from a library not compiled with deepkit.
 *
 * Note: We can't use @reflection never here because that still creates a class
 * that isClass() returns true for, but we need to simulate a class without __type.
 */
function createExternalClass(name: string): any {
    // Create a class dynamically without going through the type-compiler
    // This simulates how external library classes would appear
    const fn = new Function(`return class ${name} {}`);
    return fn();
}

/**
 * Creates a function without __type metadata to simulate external library functions.
 */
function createExternalFunction(name: string, paramCount: number = 0): any {
    if (paramCount === 0) {
        const fn = new Function(`return function ${name}() {}`);
        return fn();
    } else {
        const params = Array.from({ length: paramCount }, (_, i) => `p${i}`).join(', ');
        const fn = new Function(`return function ${name}(${params}) {}`);
        return fn();
    }
}

test('external class without __type returns TypeAny with typeName', () => {
    const ExternalService = createExternalClass('ExternalService');

    // Should not have __type metadata
    expect(ExternalService.__type).toBeUndefined();

    const result = resolveRuntimeType(ExternalService);

    expect(result.kind).toBe(ReflectionKind.any);
    expect((result as TypeAny).typeName).toBe('ExternalService');
});

test('external class with different names preserves correct typeName', () => {
    const cases = ['DatabaseClient', 'Logger', 'HttpService', 'AuthProvider', 'ConfigManager'];

    for (const name of cases) {
        const ExternalClass = createExternalClass(name);

        const result = resolveRuntimeType(ExternalClass);

        expect(result.kind).toBe(ReflectionKind.any);
        expect((result as TypeAny).typeName).toBe(name);
    }
});

test('external class via reflect() returns TypeAny with typeName', () => {
    const ExternalLibraryClass = createExternalClass('ExternalLibraryClass');

    const result = reflect(ExternalLibraryClass);

    expect(result.kind).toBe(ReflectionKind.any);
    expect((result as TypeAny).typeName).toBe('ExternalLibraryClass');
});

test('external class via reflectOrUndefined() returns TypeAny (not undefined)', () => {
    const ExternalUtil = createExternalClass('ExternalUtil');

    const result = reflectOrUndefined(ExternalUtil);

    // With graceful degradation, we get a type back instead of undefined
    expect(result).toBeDefined();
    expect(result!.kind).toBe(ReflectionKind.any);
    expect((result as TypeAny).typeName).toBe('ExternalUtil');
});

test('class with __type works normally (existing behavior)', () => {
    // This class is compiled by deepkit and has __type metadata
    class InternalClass {
        property!: string;
    }

    const result = resolveRuntimeType(InternalClass);

    // Should be a proper class type, not any
    expect(result.kind).toBe(ReflectionKind.class);
});

test('function without parameters and without __type returns function type', () => {
    const externalFn = createExternalFunction('externalFn', 0);

    // Should not have __type metadata
    expect(externalFn.__type).toBeUndefined();

    const result = resolveRuntimeType(externalFn);

    // Functions without parameters get a function type even without __type
    expect(result.kind).toBe(ReflectionKind.function);
    expect((result as any).name).toBe('externalFn');
    expect((result as any).parameters).toEqual([]);
    expect((result as any).return.kind).toBe(ReflectionKind.any);
});

test('plain objects still throw error', () => {
    const plainObject = { foo: 'bar' };

    expect(() => resolveRuntimeType(plainObject)).toThrow('No valid runtime type');
});

test('null throws error', () => {
    // null cannot have __type property accessed, so throws TypeError
    expect(() => resolveRuntimeType(null)).toThrow();
});

test('undefined throws error', () => {
    // undefined cannot have __type property accessed, so throws TypeError
    expect(() => resolveRuntimeType(undefined)).toThrow();
});

test('primitive values throw error', () => {
    expect(() => resolveRuntimeType('string')).toThrow('No valid runtime type');
    expect(() => resolveRuntimeType(123)).toThrow('No valid runtime type');
    expect(() => resolveRuntimeType(true)).toThrow('No valid runtime type');
});

test('array without __type throws error', () => {
    const arr = [1, 2, 3];
    // Arrays are "Packed" format, not classes, so they go through different path
    // but plain arrays should throw
    expect(() => resolveRuntimeType(arr as any)).toThrow();
});

test('multiple calls to resolveRuntimeType for same external class return consistent result', () => {
    const ExternalClass = createExternalClass('ConsistentClass');

    const result1 = resolveRuntimeType(ExternalClass);
    const result2 = resolveRuntimeType(ExternalClass);

    expect(result1.kind).toBe(ReflectionKind.any);
    expect(result2.kind).toBe(ReflectionKind.any);
    expect((result1 as TypeAny).typeName).toBe('ConsistentClass');
    expect((result2 as TypeAny).typeName).toBe('ConsistentClass');
});

test('typeOf with generic referencing external class in compiled code', () => {
    // When we have compiled code that references an external class type,
    // typeOf<> should still work

    class InternalWrapper<T> {
        value!: T;
    }

    // This compiles and works because InternalWrapper has __type
    const type = typeOf<InternalWrapper<string>>();

    expect(type.kind).toBe(ReflectionKind.class);
});

test('external class name with special characters is preserved', () => {
    // Test edge cases with class names
    const ClassWithNumbers123 = createExternalClass('ClassWithNumbers123');
    const result = resolveRuntimeType(ClassWithNumbers123);

    expect(result.kind).toBe(ReflectionKind.any);
    expect((result as TypeAny).typeName).toBe('ClassWithNumbers123');
});

test('external class with underscore in name is preserved', () => {
    const External_Service_Class = createExternalClass('External_Service_Class');
    const result = resolveRuntimeType(External_Service_Class);

    expect(result.kind).toBe(ReflectionKind.any);
    expect((result as TypeAny).typeName).toBe('External_Service_Class');
});

test('anonymous external class preserves whatever name JavaScript assigns', () => {
    // Create an anonymous class using eval to avoid minification giving it a name
    const AnonymousClass = eval('(class {})');

    // Note: JavaScript may still assign inferred names in some contexts
    // The important thing is that typeName matches the class.name
    const result = resolveRuntimeType(AnonymousClass);

    expect(result.kind).toBe(ReflectionKind.any);
    // typeName should match whatever JavaScript's class.name is
    expect((result as TypeAny).typeName).toBe(AnonymousClass.name);
});

test('TypeAny from external class has correct structure', () => {
    const ExternalClass = createExternalClass('StructureTest');
    const result = resolveRuntimeType(ExternalClass) as TypeAny;

    // Verify the structure matches TypeAny interface
    expect(result).toHaveProperty('kind');
    expect(result).toHaveProperty('typeName');
    expect(result.kind).toBe(ReflectionKind.any);
    expect(typeof result.typeName).toBe('string');
});

test('external class does not affect internal class resolution', () => {
    // Ensure that having external classes doesn't break internal class handling
    const ExternalClass = createExternalClass('External');

    class Internal {
        prop!: number;
    }

    // First resolve external
    const externalResult = resolveRuntimeType(ExternalClass);
    expect(externalResult.kind).toBe(ReflectionKind.any);

    // Then resolve internal - should still work correctly
    const internalResult = resolveRuntimeType(Internal);
    expect(internalResult.kind).toBe(ReflectionKind.class);
});

test('graceful degradation allows DI to provide meaningful errors', () => {
    // This test documents the use case: when DI encounters an external class,
    // it can now get the class name from typeName to provide better error messages

    const UnknownService = createExternalClass('UnknownService');
    const result = resolveRuntimeType(UnknownService) as TypeAny;

    // DI can use this information for error messages like:
    // "Cannot resolve dependency 'UnknownService'. Type information is not available."
    const errorMessage = `Cannot resolve dependency '${result.typeName}'. Type information is not available.`;

    expect(errorMessage).toContain('UnknownService');
});

test('class extending external class (simulated)', () => {
    // When a compiled class extends an external class, the external base
    // should degrade gracefully

    const ExternalBase = createExternalClass('ExternalBase');

    // Note: In real code, this would require the class to actually extend,
    // but for this test we just verify the external class degrades properly
    const result = resolveRuntimeType(ExternalBase);

    expect(result.kind).toBe(ReflectionKind.any);
    expect((result as TypeAny).typeName).toBe('ExternalBase');
});

test('ES5 style constructor function with no params returns function type', () => {
    // ES5 constructor functions are not ES6 classes
    // isClass() returns false for them, so they go through the function path
    function ES5Constructor() {
        // @ts-ignore
        this.value = 1;
    }

    // ES5 constructors with no params get function type (same as other zero-param functions)
    const result = resolveRuntimeType(ES5Constructor);

    expect(result.kind).toBe(ReflectionKind.function);
    expect((result as any).name).toBe('ES5Constructor');
    expect((result as any).parameters).toEqual([]);
});

test('arrow function with no params returns function type', () => {
    const arrowFn = () => {};

    // Arrow functions with no params also get the function type treatment
    const result = resolveRuntimeType(arrowFn);

    expect(result.kind).toBe(ReflectionKind.function);
    expect((result as any).parameters).toEqual([]);
});

test('function with parameters without __type throws error', () => {
    // Create a function with parameters dynamically (without type-compiler)
    const fnWithParams = createExternalFunction('fnWithParams', 2);

    // Functions with parameters that don't have __type should throw
    // because they can't be treated as zero-param functions
    expect(() => resolveRuntimeType(fnWithParams)).toThrow('No valid runtime type');
});
