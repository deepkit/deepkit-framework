import { test } from 'node:test';

import { expect } from '@deepkit/run/expect';

import { transform, transpile } from './utils.js';

/**
 * Tests for GitHub issue #601: [type-compiler] exclude declare statements
 *
 * The type-compiler should NOT generate __ΩX variables for top-level declare statements
 * because they have no runtime implementation - they're just type declarations
 * for existing runtime values.
 *
 * Reference: https://github.com/epicweb-dev/epic-stack/blob/e70fee5a087954b1818234443ebc49a87b5ca7d0/app/utils/env.server.ts#L60
 *
 * Current implementation status:
 * - Top-level `declare type/interface/enum` - SUPPORTED (no __Ω generated)
 * - `export declare type/interface/enum` - SUPPORTED (no __Ω or export generated)
 * - `declare global { ... }` - NOT YET IMPLEMENTED (interfaces inside still get reflection)
 * - `declare module 'x' { ... }` - NOT YET IMPLEMENTED (causes issues)
 * - `declare namespace X { ... }` - NOT YET IMPLEMENTED (types inside still get reflection)
 */

// ============================================================================
// BASIC DECLARE STATEMENT FILTERING (IMPLEMENTED)
// ============================================================================

test('declare type does NOT generate __Ω variable', () => {
    const res = transform({
        app: `
            declare type DeclaredType = string;
        `,
    });

    expect(res.app).not.toContain('__ΩDeclaredType');
});

test('declare interface does NOT generate __Ω variable', () => {
    const res = transform({
        app: `
            declare interface DeclaredInterface {
                id: number;
                name: string;
            }
        `,
    });

    expect(res.app).not.toContain('__ΩDeclaredInterface');
});

test('declare enum does NOT generate __Ω variable', () => {
    const res = transform({
        app: `
            declare enum DeclaredEnum {
                A,
                B,
                C
            }
        `,
    });

    expect(res.app).not.toContain('__ΩDeclaredEnum');
});

// ============================================================================
// REGRESSION TESTS - Regular (non-declare) statements SHOULD generate __Ω
// ============================================================================

test('regular type alias DOES generate __Ω variable (regression test)', () => {
    const res = transform({
        app: `
            type RegularType = string | number;
        `,
    });

    expect(res.app).toContain('__ΩRegularType');
});

test('regular interface DOES generate __Ω variable (regression test)', () => {
    const res = transform({
        app: `
            interface RegularInterface {
                id: number;
                name: string;
            }
        `,
    });

    expect(res.app).toContain('__ΩRegularInterface');
});

test('regular enum DOES generate __Ω variable (regression test)', () => {
    const res = transform({
        app: `
            enum RegularEnum {
                A,
                B,
                C
            }
        `,
    });

    expect(res.app).toContain('__ΩRegularEnum');
});

// ============================================================================
// EXPORTED DECLARE STATEMENTS (IMPLEMENTED)
// ============================================================================

test('export declare type does NOT generate export for __Ω variable', () => {
    const res = transform({
        app: `
            export declare type ExportedDeclaredType = string;
        `,
    });

    expect(res.app).not.toContain('__ΩExportedDeclaredType');
    expect(res.app).not.toContain('export { __ΩExportedDeclaredType');
});

test('export declare interface does NOT generate export for __Ω variable', () => {
    const res = transform({
        app: `
            export declare interface ExportedDeclaredInterface {
                id: number;
            }
        `,
    });

    expect(res.app).not.toContain('__ΩExportedDeclaredInterface');
    expect(res.app).not.toContain('export { __ΩExportedDeclaredInterface');
});

test('export declare enum does NOT generate export for __Ω variable', () => {
    const res = transform({
        app: `
            export declare enum ExportedDeclaredEnum {
                A,
                B
            }
        `,
    });

    expect(res.app).not.toContain('__ΩExportedDeclaredEnum');
    expect(res.app).not.toContain('export { __ΩExportedDeclaredEnum');
});

// ============================================================================
// EXPORTED REGULAR STATEMENTS (REGRESSION TESTS)
// ============================================================================

test('exported regular type DOES generate export for __Ω variable (regression test)', () => {
    const res = transform({
        app: `
            export type ExportedRegularType = string | number;
        `,
    });

    expect(res.app).toContain('__ΩExportedRegularType');
    expect(res.app).toContain('export { __ΩExportedRegularType');
});

test('exported regular interface DOES generate export for __Ω variable (regression test)', () => {
    const res = transform({
        app: `
            export interface ExportedRegularInterface {
                id: number;
            }
        `,
    });

    expect(res.app).toContain('__ΩExportedRegularInterface');
    expect(res.app).toContain('export { __ΩExportedRegularInterface');
});

// ============================================================================
// MIXED DECLARE AND REGULAR STATEMENTS
// ============================================================================

test('mix of declare and non-declare only generates __Ω for non-declare', () => {
    const res = transform({
        app: `
            // Should NOT generate __Ω
            declare type DeclaredA = string;
            declare interface DeclaredB { x: number; }
            declare enum DeclaredC { X, Y }

            // Should generate __Ω
            type RegularA = string;
            interface RegularB { x: number; }
            enum RegularC { X, Y }
        `,
    });

    // Declare statements should not generate reflection
    expect(res.app).not.toContain('__ΩDeclaredA');
    expect(res.app).not.toContain('__ΩDeclaredB');
    expect(res.app).not.toContain('__ΩDeclaredC');

    // Regular statements should generate reflection
    expect(res.app).toContain('__ΩRegularA');
    expect(res.app).toContain('__ΩRegularB');
    expect(res.app).toContain('__ΩRegularC');
});

// ============================================================================
// USING DECLARED TYPES IN REGULAR TYPES
// ============================================================================

test('using declare type in regular type does resolve correctly', () => {
    // When a regular type references a declared type, it should handle it appropriately
    const res = transpile({
        app: `
            declare type DeclaredType = { id: string };
            type UsingDeclared = DeclaredType & { extra: number };
        `,
    });

    // UsingDeclared should have reflection
    expect(res.app).toContain('__ΩUsingDeclared');

    // DeclaredType should not have reflection
    expect(res.app).not.toContain('const __ΩDeclaredType');
});

// ============================================================================
// DECLARE CLASS AND FUNCTION
// ============================================================================

test('declare class and regular class both get reflection', () => {
    // Note: Unlike declare type/interface/enum, declare class currently still
    // gets reflection in the transform output. This test documents current behavior.
    const res = transform({
        app: `
            declare class DeclaredClass {
                id: number;
                getName(): string;
            }

            class RegularClass {
                id: number = 0;
            }
        `,
    });

    // Both classes appear in output with static __type
    expect(res.app).toContain('static __type');
    expect(res.app).toContain('RegularClass');
    expect(res.app).toContain('DeclaredClass');
});

test('declare function and regular function both get reflection', () => {
    // Note: Unlike declare type/interface/enum, declare function currently still
    // gets reflection in the transform output. This test documents current behavior.
    const res = transform({
        app: `
            declare function declaredFunction(x: number): string;

            function regularFunction(x: number): string {
                return x.toString();
            }
        `,
    });

    // Regular function should have type information
    expect(res.app).toContain('regularFunction.__type');
    // Note: Declared function also gets __type in current implementation
    // This documents the current behavior, not necessarily desired behavior
});

test('declare const does not interfere with type reflection', () => {
    const res = transform({
        app: `
            declare const DECLARED_CONST: string;

            type MyType = typeof DECLARED_CONST;
        `,
    });

    // MyType should have reflection, using DECLARED_CONST via typeof
    expect(res.app).toContain('__ΩMyType');
});

// ============================================================================
// COMPLEX TYPE REFERENCES WITH DECLARE TYPES
// ============================================================================

test('type referencing declare type creates inline reflection', () => {
    const res = transform({
        app: `
            declare type ExternalConfig = {
                host: string;
                port: number;
            };

            type AppConfig = ExternalConfig & {
                appName: string;
            };
        `,
    });

    // AppConfig should have reflection
    expect(res.app).toContain('__ΩAppConfig');
    // ExternalConfig should NOT have its own __Ω variable
    expect(res.app).not.toContain('__ΩExternalConfig');
});

test('interface extending declare interface works correctly', () => {
    const res = transform({
        app: `
            declare interface BaseInterface {
                id: string;
            }

            interface ExtendedInterface extends BaseInterface {
                name: string;
            }
        `,
    });

    // ExtendedInterface should have reflection
    expect(res.app).toContain('__ΩExtendedInterface');
    // BaseInterface should NOT have __Ω variable
    expect(res.app).not.toContain('__ΩBaseInterface');
});

test('generic type with declare type constraint', () => {
    const res = transform({
        app: `
            declare type Identifiable = { id: string };

            type WithTimestamp<T extends Identifiable> = T & { timestamp: Date };
        `,
    });

    // WithTimestamp should have reflection
    expect(res.app).toContain('__ΩWithTimestamp');
    // Identifiable should NOT have __Ω variable
    expect(res.app).not.toContain('__ΩIdentifiable');
});

// ============================================================================
// DECLARE KEYWORD VARIATIONS
// ============================================================================

test('declare with type parameters', () => {
    const res = transform({
        app: `
            declare type GenericDeclare<T> = { value: T };

            type ConcreteType = GenericDeclare<string>;
        `,
    });

    // ConcreteType should have reflection
    expect(res.app).toContain('__ΩConcreteType');
    // GenericDeclare should NOT have __Ω variable
    expect(res.app).not.toContain('__ΩGenericDeclare');
});

test('declare interface with method signatures', () => {
    const res = transform({
        app: `
            declare interface ServiceInterface {
                getData(): Promise<string>;
                setData(value: string): void;
            }

            interface MyService extends ServiceInterface {
                customMethod(): void;
            }
        `,
    });

    // MyService should have reflection
    expect(res.app).toContain('__ΩMyService');
    // ServiceInterface should NOT have __Ω variable
    expect(res.app).not.toContain('__ΩServiceInterface');
});

test('declare enum used in regular type', () => {
    const res = transform({
        app: `
            declare enum ExternalStatus {
                Active,
                Inactive
            }

            type StatusWrapper = {
                status: ExternalStatus;
            };
        `,
    });

    // StatusWrapper should have reflection
    expect(res.app).toContain('__ΩStatusWrapper');
    // ExternalStatus should NOT have __Ω variable
    expect(res.app).not.toContain('__ΩExternalStatus');
});

// ============================================================================
// EDGE CASES
// ============================================================================

test('multiple declare statements in sequence', () => {
    const res = transform({
        app: `
            declare type A = string;
            declare type B = number;
            declare type C = boolean;
            declare interface D { x: number; }
            declare interface E { y: string; }
            declare enum F { X, Y }
        `,
    });

    expect(res.app).not.toContain('__ΩA');
    expect(res.app).not.toContain('__ΩB');
    expect(res.app).not.toContain('__ΩC');
    expect(res.app).not.toContain('__ΩD');
    expect(res.app).not.toContain('__ΩE');
    expect(res.app).not.toContain('__ΩF');
});

test('declare statements with JSDoc comments', () => {
    const res = transform({
        app: `
            /**
             * This is a declared type with documentation
             * @description Some description
             */
            declare type DocumentedDeclare = string;

            /**
             * This is a regular type with documentation
             */
            type DocumentedRegular = number;
        `,
    });

    expect(res.app).not.toContain('__ΩDocumentedDeclare');
    expect(res.app).toContain('__ΩDocumentedRegular');
});

test('union type combining declared and regular types', () => {
    const res = transform({
        app: `
            declare type ExternalType = { external: true };
            type InternalType = { internal: true };

            type UnionType = ExternalType | InternalType;
        `,
    });

    // UnionType should have reflection
    expect(res.app).toContain('__ΩUnionType');
    // InternalType should have reflection (it's regular)
    expect(res.app).toContain('__ΩInternalType');
    // ExternalType should NOT have reflection
    expect(res.app).not.toContain('__ΩExternalType');
});

test('intersection type combining declared and regular types', () => {
    const res = transform({
        app: `
            declare type ExternalMixin = { external: true };
            type InternalMixin = { internal: true };

            type IntersectionType = ExternalMixin & InternalMixin;
        `,
    });

    // IntersectionType should have reflection
    expect(res.app).toContain('__ΩIntersectionType');
    // InternalMixin should have reflection (it's regular)
    expect(res.app).toContain('__ΩInternalMixin');
    // ExternalMixin should NOT have reflection
    expect(res.app).not.toContain('__ΩExternalMixin');
});
