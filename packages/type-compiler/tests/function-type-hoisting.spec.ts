import { test } from 'node:test';

import { expect } from '@deepkit/run/expect';

import { transform, transpile, transpileAndRun } from './utils.js';

/**
 * Tests for GitHub issue #664: function __type should be hoisted
 *
 * Function declarations in JavaScript are hoisted, meaning they can be called
 * before their declaration in source code. The `__type` assignment for function
 * type information should be hoisted in a similar manner to support this pattern:
 *
 * ```ts
 * ReflectionFunction.from(myFunc).getParameters(); // Should work!
 *
 * function myFunc(a: string) {}
 * ```
 *
 * The hoisting feature was implemented by collecting module-level function __type
 * assignments and inserting them at the top of the file (after "use strict" etc).
 */

// ============================================================================
// MODULE-LEVEL FUNCTION __type HOISTING
// ============================================================================

test('module-level function __type is hoisted before the function declaration', () => {
    const res = transform({
        app: `
            function greet(name: string): string {
                return "Hello, " + name;
            }
        `,
    });

    // __type assignment is hoisted to the top
    expect(res.app).toContain('function greet');
    expect(res.app).toContain('greet.__type =');

    // Check order: __type should come BEFORE function declaration (hoisted)
    const funcIndex = res.app.indexOf('function greet');
    const typeIndex = res.app.indexOf('greet.__type =');
    expect(typeIndex).toBeLessThan(funcIndex);
});

test('module-level function with complex parameter types has hoisted __type', () => {
    const res = transform({
        app: `
            interface User {
                id: number;
                name: string;
            }

            function processUser(user: User, count: number): User {
                return user;
            }
        `,
    });

    expect(res.app).toContain('processUser.__type');
    expect(res.app).toContain('__ΩUser');

    // __type should be hoisted before the function
    const funcIndex = res.app.indexOf('function processUser');
    const typeIndex = res.app.indexOf('processUser.__type');
    expect(typeIndex).toBeLessThan(funcIndex);
});

test('multiple module-level functions all get hoisted __type', () => {
    const res = transform({
        app: `
            function first(a: string): void {}
            function second(b: number): boolean { return true; }
            function third(c: boolean): string { return ""; }
        `,
    });

    expect(res.app).toContain('first.__type');
    expect(res.app).toContain('second.__type');
    expect(res.app).toContain('third.__type');

    // All __type assignments should come before function declarations
    const firstFuncIndex = res.app.indexOf('function first');
    const firstTypeIndex = res.app.indexOf('first.__type');
    const secondTypeIndex = res.app.indexOf('second.__type');
    const thirdTypeIndex = res.app.indexOf('third.__type');

    expect(firstTypeIndex).toBeLessThan(firstFuncIndex);
    expect(secondTypeIndex).toBeLessThan(firstFuncIndex);
    expect(thirdTypeIndex).toBeLessThan(firstFuncIndex);
});

test('hoisted __type assignments appear after "use strict"', () => {
    const res = transform({
        app: `
            "use strict";
            function greet(name: string): void {}
        `,
    });

    expect(res.app).toContain('greet.__type');

    // "use strict" should be first
    const useStrictIndex = res.app.indexOf('"use strict"');
    const typeIndex = res.app.indexOf('greet.__type');
    expect(useStrictIndex).toBeLessThan(typeIndex);
});

test('hoisted __type assignments appear after "use client"', () => {
    const res = transform({
        app: `
            "use client";
            function component(props: { name: string }): void {}
        `,
    });

    expect(res.app).toContain('component.__type');

    // "use client" should be first
    const useClientIndex = res.app.indexOf('"use client"');
    const typeIndex = res.app.indexOf('component.__type');
    expect(useClientIndex).toBeLessThan(typeIndex);
});

// ============================================================================
// BLOCK-SCOPED FUNCTION DECLARATIONS - __type stays inline
// ============================================================================

test('function inside if block keeps __type inline (not hoisted to module level)', () => {
    const res = transform({
        app: `
            if (true) {
                function insideIf(x: number): void {}
            }
        `,
    });

    // Block-scoped functions should still get __type
    expect(res.app).toContain('insideIf.__type');

    // __type should come AFTER the function (inline, within the block)
    const funcIndex = res.app.indexOf('function insideIf');
    const typeIndex = res.app.indexOf('insideIf.__type');
    expect(typeIndex).toBeGreaterThan(funcIndex);
});

test('function inside for loop keeps __type inline', () => {
    const res = transform({
        app: `
            for (let i = 0; i < 10; i++) {
                function insideFor(x: number): void {}
            }
        `,
    });

    expect(res.app).toContain('insideFor.__type');

    // __type should come AFTER the function (inline)
    const funcIndex = res.app.indexOf('function insideFor');
    const typeIndex = res.app.indexOf('insideFor.__type');
    expect(typeIndex).toBeGreaterThan(funcIndex);
});

test('function inside while loop keeps __type inline', () => {
    const res = transform({
        app: `
            while (true) {
                function insideWhile(x: number): void {}
                break;
            }
        `,
    });

    expect(res.app).toContain('insideWhile.__type');

    const funcIndex = res.app.indexOf('function insideWhile');
    const typeIndex = res.app.indexOf('insideWhile.__type');
    expect(typeIndex).toBeGreaterThan(funcIndex);
});

test('function inside block statement keeps __type inline', () => {
    const res = transform({
        app: `
            {
                function insideBlock(x: number): void {}
            }
        `,
    });

    expect(res.app).toContain('insideBlock.__type');

    const funcIndex = res.app.indexOf('function insideBlock');
    const typeIndex = res.app.indexOf('insideBlock.__type');
    expect(typeIndex).toBeGreaterThan(funcIndex);
});

// ============================================================================
// NESTED FUNCTION DECLARATIONS - inner function __type stays inline
// ============================================================================

test('nested function inside another function: outer hoisted, inner inline', () => {
    const res = transform({
        app: `
            function outer(a: string): void {
                function inner(b: number): boolean {
                    return b > 0;
                }
                inner(1);
            }
        `,
    });

    // Both outer and inner should get __type
    expect(res.app).toContain('outer.__type');
    expect(res.app).toContain('inner.__type');

    // outer.__type should be hoisted (before outer function)
    const outerFuncIndex = res.app.indexOf('function outer');
    const outerTypeIndex = res.app.indexOf('outer.__type');
    expect(outerTypeIndex).toBeLessThan(outerFuncIndex);

    // inner.__type should be inline (after inner function, within outer's body)
    const innerFuncIndex = res.app.indexOf('function inner');
    const innerTypeIndex = res.app.indexOf('inner.__type');
    expect(innerTypeIndex).toBeGreaterThan(innerFuncIndex);
});

test('deeply nested function declarations', () => {
    const res = transform({
        app: `
            function level1(a: string): void {
                function level2(b: number): void {
                    function level3(c: boolean): string {
                        return String(c);
                    }
                }
            }
        `,
    });

    expect(res.app).toContain('level1.__type');
    expect(res.app).toContain('level2.__type');
    expect(res.app).toContain('level3.__type');

    // level1.__type should be hoisted
    const level1FuncIndex = res.app.indexOf('function level1');
    const level1TypeIndex = res.app.indexOf('level1.__type');
    expect(level1TypeIndex).toBeLessThan(level1FuncIndex);

    // level2 and level3 are nested, so their __type stays inline
    const level2FuncIndex = res.app.indexOf('function level2');
    const level2TypeIndex = res.app.indexOf('level2.__type');
    expect(level2TypeIndex).toBeGreaterThan(level2FuncIndex);

    const level3FuncIndex = res.app.indexOf('function level3');
    const level3TypeIndex = res.app.indexOf('level3.__type');
    expect(level3TypeIndex).toBeGreaterThan(level3FuncIndex);
});

// ============================================================================
// EXPORTED FUNCTION DECLARATIONS
// ============================================================================

test('exported function gets hoisted __type', () => {
    const res = transform({
        app: `
            export function exportedFunc(x: string): number {
                return x.length;
            }
        `,
    });

    expect(res.app).toContain('exportedFunc.__type');

    // __type should be hoisted
    const funcIndex = res.app.indexOf('function exportedFunc');
    const typeIndex = res.app.indexOf('exportedFunc.__type');
    expect(typeIndex).toBeLessThan(funcIndex);
});

test('export default named function gets hoisted __type', () => {
    const res = transform({
        app: `
            export default function namedDefault(x: string): void {}
        `,
    });

    // Named default export functions get __type hoisted
    expect(res.app).toContain('namedDefault.__type');

    const funcIndex = res.app.indexOf('function namedDefault');
    const typeIndex = res.app.indexOf('namedDefault.__type');
    expect(typeIndex).toBeLessThan(funcIndex);
});

test('export default anonymous function gets __assignType wrapper', () => {
    const res = transform({
        app: `
            export default function(x: string): void {}
        `,
    });

    // Anonymous default exports cannot be hoisted, so they use __assignType wrapper
    expect(res.app).toContain('__assignType');
});

// ============================================================================
// ARROW FUNCTIONS AND FUNCTION EXPRESSIONS - use __assignType wrapper
// ============================================================================

test('arrow function uses __assignType wrapper', () => {
    const res = transform({
        app: `
            const arrowFn = (x: string): number => x.length;
        `,
    });

    // Arrow functions get wrapped with __assignType (cannot be hoisted)
    expect(res.app).toContain('__assignType');
});

test('function expression uses __assignType wrapper', () => {
    const res = transform({
        app: `
            const funcExpr = function(x: string): number {
                return x.length;
            };
        `,
    });

    expect(res.app).toContain('__assignType');
});

test('named function expression uses __assignType wrapper', () => {
    const res = transform({
        app: `
            const funcExpr = function namedExpr(x: string): number {
                return x.length;
            };
        `,
    });

    expect(res.app).toContain('__assignType');
});

// ============================================================================
// FUNCTION WITH TYPES FROM OTHER FILES
// ============================================================================

test('function with imported type reference has hoisted __type', () => {
    const res = transform({
        app: `
            import { Logger } from './logger.js';

            function logMessage(logger: Logger, message: string): void {
                logger.log(message);
            }
        `,
        logger: `
            export class Logger {
                log(msg: string): void {}
            }
        `,
    });

    expect(res.app).toContain('logMessage.__type');
    expect(res.app).toContain('() => Logger');

    // __type should be hoisted
    const funcIndex = res.app.indexOf('function logMessage');
    const typeIndex = res.app.indexOf('logMessage.__type');
    expect(typeIndex).toBeLessThan(funcIndex);
});

test('function with type alias reference has hoisted __type', () => {
    const res = transform({
        app: `
            type UserId = string & { __brand: 'UserId' };

            function getUser(id: UserId): void {}
        `,
    });

    expect(res.app).toContain('getUser.__type');
    expect(res.app).toContain('__ΩUserId');

    const funcIndex = res.app.indexOf('function getUser');
    const typeIndex = res.app.indexOf('getUser.__type');
    expect(typeIndex).toBeLessThan(funcIndex);
});

test('function referencing interface defined later in file', () => {
    const res = transform({
        app: `
            function processItem(item: Item): void {}

            interface Item {
                id: number;
                name: string;
            }
        `,
    });

    expect(res.app).toContain('processItem.__type');
    expect(res.app).toContain('__ΩItem');

    // __type should be hoisted
    const funcIndex = res.app.indexOf('function processItem');
    const typeIndex = res.app.indexOf('processItem.__type');
    expect(typeIndex).toBeLessThan(funcIndex);
});

// ============================================================================
// ASYNC FUNCTIONS AND GENERATORS
// ============================================================================

test('async function gets hoisted __type', () => {
    const res = transform({
        app: `
            async function fetchData(url: string): Promise<string> {
                return url;
            }
        `,
    });

    expect(res.app).toContain('fetchData.__type');

    const funcIndex = res.app.indexOf('async function fetchData');
    const typeIndex = res.app.indexOf('fetchData.__type');
    expect(typeIndex).toBeLessThan(funcIndex);
});

test('generator function gets hoisted __type', () => {
    const res = transform({
        app: `
            function* generateNumbers(max: number): Generator<number> {
                for (let i = 0; i < max; i++) {
                    yield i;
                }
            }
        `,
    });

    expect(res.app).toContain('generateNumbers.__type');

    const funcIndex = res.app.indexOf('function* generateNumbers');
    const typeIndex = res.app.indexOf('generateNumbers.__type');
    expect(typeIndex).toBeLessThan(funcIndex);
});

test('async generator function gets hoisted __type', () => {
    const res = transform({
        app: `
            async function* asyncGenerator(items: string[]): AsyncGenerator<string> {
                for (const item of items) {
                    yield item;
                }
            }
        `,
    });

    expect(res.app).toContain('asyncGenerator.__type');

    const funcIndex = res.app.indexOf('async function* asyncGenerator');
    const typeIndex = res.app.indexOf('asyncGenerator.__type');
    expect(typeIndex).toBeLessThan(funcIndex);
});

// ============================================================================
// RUNTIME TESTS - REFLECTION FUNCTION
// ============================================================================

test('runtime: ReflectionFunction.from works when function is declared first', () => {
    const res = transpileAndRun({
        app: `
            function greet(name: string): string {
                return "Hello, " + name;
            }

            const rf = require('@deepkit/type').ReflectionFunction;
            const reflection = rf.from(greet);
            reflection.getParameters().length;
        `,
    });

    expect(res).toBe(1);
});

test('runtime: ReflectionFunction.from works BEFORE function declaration (hoisting)', () => {
    // This is the key test for issue #664 - calling ReflectionFunction.from
    // before the function is declared should still work because __type is hoisted
    const res = transpileAndRun({
        app: `
            const rf = require('@deepkit/type').ReflectionFunction;
            const reflection = rf.from(greet);
            const count = reflection.getParameters().length;

            function greet(name: string): string {
                return "Hello, " + name;
            }

            count;
        `,
    });

    // Should return 1 because __type was hoisted before the function declaration
    expect(res).toBe(1);
});

test('runtime: function with multiple parameters has correct parameter count', () => {
    const res = transpileAndRun({
        app: `
            function multi(a: string, b: number, c: boolean): void {}

            const rf = require('@deepkit/type').ReflectionFunction;
            const reflection = rf.from(multi);
            reflection.getParameters().length;
        `,
    });

    expect(res).toBe(3);
});

test('runtime: arrow function reflection works', () => {
    const res = transpileAndRun({
        app: `
            const arrowFn = (x: string, y: number): boolean => true;

            const rf = require('@deepkit/type').ReflectionFunction;
            const reflection = rf.from(arrowFn);
            reflection.getParameters().length;
        `,
    });

    expect(res).toBe(2);
});

test('runtime: function expression reflection works', () => {
    const res = transpileAndRun({
        app: `
            const funcExpr = function(a: string, b: string): string {
                return a + b;
            };

            const rf = require('@deepkit/type').ReflectionFunction;
            const reflection = rf.from(funcExpr);
            reflection.getParameters().length;
        `,
    });

    expect(res).toBe(2);
});

// ============================================================================
// GENERIC FUNCTIONS
// ============================================================================

test('generic function gets hoisted __type', () => {
    const res = transform({
        app: `
            function identity<T>(value: T): T {
                return value;
            }
        `,
    });

    expect(res.app).toContain('identity.__type');

    const funcIndex = res.app.indexOf('function identity');
    const typeIndex = res.app.indexOf('identity.__type');
    expect(typeIndex).toBeLessThan(funcIndex);
});

test('function with multiple type parameters', () => {
    const res = transform({
        app: `
            function map<T, U>(items: T[], transform: (item: T) => U): U[] {
                return items.map(transform);
            }
        `,
    });

    expect(res.app).toContain('map.__type');
});

test('function with constrained type parameter', () => {
    const res = transform({
        app: `
            interface Lengthwise {
                length: number;
            }

            function logLength<T extends Lengthwise>(arg: T): number {
                return arg.length;
            }
        `,
    });

    expect(res.app).toContain('logLength.__type');
});

// ============================================================================
// OVERLOADED FUNCTIONS
// ============================================================================

test('overloaded function declarations', () => {
    const res = transform({
        app: `
            function process(x: string): string;
            function process(x: number): number;
            function process(x: string | number): string | number {
                return x;
            }
        `,
    });

    // Implementation should get __type
    expect(res.app).toContain('process.__type');
});

// ============================================================================
// EDGE CASES
// ============================================================================

test('function with destructured parameters', () => {
    const res = transform({
        app: `
            function destructured({ name, age }: { name: string; age: number }): string {
                return name;
            }
        `,
    });

    expect(res.app).toContain('destructured.__type');
});

test('function with rest parameters', () => {
    const res = transform({
        app: `
            function withRest(first: string, ...rest: number[]): void {}
        `,
    });

    expect(res.app).toContain('withRest.__type');
});

test('function with default parameters', () => {
    const res = transform({
        app: `
            function withDefaults(name: string = "default", count: number = 0): void {}
        `,
    });

    expect(res.app).toContain('withDefaults.__type');
});

test('function with optional parameters', () => {
    const res = transform({
        app: `
            function withOptional(required: string, optional?: number): void {}
        `,
    });

    expect(res.app).toContain('withOptional.__type');
});

test('function returning void', () => {
    const res = transform({
        app: `
            function returnsVoid(): void {}
        `,
    });

    expect(res.app).toContain('returnsVoid.__type');
});

test('function returning never', () => {
    const res = transform({
        app: `
            function throwsError(): never {
                throw new Error("Always throws");
            }
        `,
    });

    expect(res.app).toContain('throwsError.__type');
});

// ============================================================================
// MIXED SCENARIOS
// ============================================================================

test('file with mixed function types: declarations hoisted, expressions wrapped', () => {
    const res = transform({
        app: `
            // Regular function declaration
            function declaredFunc(a: string): void {}

            // Arrow function
            const arrowFunc = (b: number): boolean => true;

            // Function expression
            const exprFunc = function(c: boolean): string { return ""; };

            // Exported function
            export function exportedFunc(d: object): number { return 0; }
        `,
    });

    expect(res.app).toContain('declaredFunc.__type');
    expect(res.app).toContain('exportedFunc.__type');
    // Arrow and expression functions use __assignType
    expect(res.app).toContain('__assignType');

    // Function declarations should have hoisted __type
    const declaredFuncIndex = res.app.indexOf('function declaredFunc');
    const declaredTypeIndex = res.app.indexOf('declaredFunc.__type');
    expect(declaredTypeIndex).toBeLessThan(declaredFuncIndex);
});

// ============================================================================
// DECLARATION FILES
// ============================================================================

test('declare function does not cause issues', () => {
    const res = transform({
        app: `
            declare function externalFunc(x: number): string;

            function localFunc(y: number): string {
                return String(y);
            }
        `,
    });

    // Local function should get __type
    expect(res.app).toContain('localFunc.__type');
});

// ============================================================================
// IIFE (Immediately Invoked Function Expression)
// ============================================================================

test('IIFE function expression uses __assignType', () => {
    const res = transform({
        app: `
            const result = (function(x: number): number {
                return x * 2;
            })(5);
        `,
    });

    // IIFE should use __assignType (cannot be hoisted)
    expect(res.app).toContain('__assignType');
});

// ============================================================================
// CLASS METHODS VS STANDALONE FUNCTIONS
// ============================================================================

test('class methods do not conflict with standalone functions', () => {
    const res = transform({
        app: `
            class MyClass {
                method(x: string): void {}
            }

            function standaloneFunc(x: string): void {}
        `,
    });

    // Class gets static __type
    expect(res.app).toContain('static __type');
    // Standalone function gets its own __type (hoisted)
    expect(res.app).toContain('standaloneFunc.__type');

    const funcIndex = res.app.indexOf('function standaloneFunc');
    const typeIndex = res.app.indexOf('standaloneFunc.__type');
    expect(typeIndex).toBeLessThan(funcIndex);
});

// ============================================================================
// TRANSPILE TESTS (Full compilation)
// ============================================================================

test('transpile: hoisted __type appears before function in output', () => {
    const res = transpile({
        app: `
            function greet(name: string): string {
                return "Hello, " + name;
            }
        `,
    });

    expect(res.app).toContain('greet.__type');
    expect(res.app).toContain('function greet');

    // Verify hoisting in transpiled output
    const typeIndex = res.app.indexOf('greet.__type');
    const funcIndex = res.app.indexOf('function greet');
    expect(typeIndex).toBeLessThan(funcIndex);
});

test('transpile: multiple functions all have hoisted __type', () => {
    const res = transpile({
        app: `
            function first(a: string): void {}
            function second(b: number): boolean { return true; }
            function third(c: boolean): string { return ""; }
        `,
    });

    expect(res.app).toContain('first.__type');
    expect(res.app).toContain('second.__type');
    expect(res.app).toContain('third.__type');

    // All __type should be hoisted
    const firstFuncIndex = res.app.indexOf('function first');
    const firstTypeIndex = res.app.indexOf('first.__type');
    expect(firstTypeIndex).toBeLessThan(firstFuncIndex);
});

// ============================================================================
// UNTYPED ARROW FUNCTIONS - should not break reflection
// ============================================================================

/**
 * Tests for untyped arrow functions that should NOT be decorated with __assignType.
 *
 * When an arrow function has no explicit type annotations and no parameters,
 * the type-compiler should either:
 * - Not decorate it at all (original behavior)
 * - Or emit a proper function type (function returning any)
 *
 * The issue was that after fix #352, empty ops were converted to `any` type,
 * but this breaks ReflectionFunction.from() which expects a function type.
 * See: GitHub Actions CI failure on feat/next branch.
 */
test('runtime: untyped arrow function without parameters still works with ReflectionFunction', () => {
    const res = transpileAndRun({
        app: `
            // Simulate a class with a property accessed via 'this'
            class Container {
                value = 42;

                getFactory() {
                    // Arrow function with no type annotations referencing 'this'
                    return () => this.value;
                }
            }

            const container = new Container();
            const factory = container.getFactory();

            // ReflectionFunction.from should work without throwing
            const rf = require('@deepkit/type').ReflectionFunction;
            const reflection = rf.from(factory);

            // Should get a valid function type (with 'any' return type as fallback)
            reflection.type.kind; // Should be ReflectionKind.function (not throw)
        `,
    });

    // ReflectionKind.function = 17
    expect(res).toBe(17);
});

test('runtime: untyped arrow function in provider-like pattern works', () => {
    const res = transpileAndRun({
        app: `
            // This simulates the pattern used in @deepkit/app service-container:
            // { provide: InjectorContext, useFactory: () => this.injectorContext }
            class ServiceContainer {
                private contextValue = 'test-context';

                addProvider(config: { useFactory: () => any }) {
                    // The injector calls ReflectionFunction.from on the factory
                    const rf = require('@deepkit/type').ReflectionFunction;
                    const reflection = rf.from(config.useFactory);
                    return reflection.type.kind;
                }
            }

            const container = new ServiceContainer();
            // This is the pattern that was breaking
            const result = container.addProvider({
                useFactory: () => container['contextValue']
            });

            result;
        `,
    });

    // ReflectionKind.function = 17
    expect(res).toBe(17);
});

test('transform: untyped arrow function should not get invalid __assignType', () => {
    const res = transform({
        app: `
            class Container {
                value = 42;
                getFactory() {
                    return () => this.value;
                }
            }
        `,
    });

    // The arrow function should either:
    // 1. Not be wrapped with __assignType at all, OR
    // 2. Be wrapped with a proper function type (not just 'any')
    //
    // Invalid: __assignType(() => this.value, ['"'])
    // Valid: no __assignType, OR __assignType with proper function bytecode

    // Check that if __assignType is present, it doesn't have just ['"'] (which is just 'any')
    // The pattern ['"'] means the type is 'any', not 'function returning any'
    const hasInvalidAnyOnlyType = res.app.includes("__assignType(() => this.value, ['\"'");

    expect(hasInvalidAnyOnlyType).toBe(false);
});
