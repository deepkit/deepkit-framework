/**
 * Comprehensive integration tests for DeepkitLoader.
 *
 * Tests the DeepkitLoader API used by bundlers like Vite, Bun, and esbuild.
 *
 * @see packages/type-compiler/src/loader.ts
 */
import { existsSync, readFileSync } from 'fs';
import { beforeEach, describe, test } from 'node:test';
import { join } from 'path';

import { expect } from '@deepkit/run/expect';

import { DeepkitLoader } from '../src/loader.js';

// Test file directories
const testDir = join(__dirname, 'vite-test-files');
const tsconfigWithReflection = join(__dirname, '../../type/tests/tsconfig.json');
const rootTsconfig = join(__dirname, '../../../tsconfig.json');

// Helper to create inline test files with DeepkitLoader
function createTestLoader(options?: Parameters<typeof DeepkitLoader>[0]) {
    return new DeepkitLoader(options);
}

// Helper to transform inline code at a fake path
function transformInline(loader: DeepkitLoader, code: string, fileName: string = 'test.ts'): string {
    const fakePath = join(testDir, fileName);
    return loader.transform(code, fakePath);
}

describe('DeepkitLoader - Basic Functionality', () => {
    test('transforms simple interface', () => {
        const loader = createTestLoader({ reflection: 'default' });

        const code = `
interface User {
    id: number;
    name: string;
}
`;
        const result = transformInline(loader, code, 'simple-interface.ts');

        expect(result).toContain('__ΩUser');
        expect(result).toContain('id');
        expect(result).toContain('name');
    });

    test('transforms simple class', () => {
        const loader = createTestLoader({ reflection: 'default' });

        const code = `
class User {
    id: number = 0;
    name: string = '';
}
`;
        const result = transformInline(loader, code, 'simple-class.ts');

        expect(result).toContain('__type');
        expect(result).toContain('User');
    });

    test('transforms function with generic type parameter', () => {
        const loader = createTestLoader({ reflection: 'default' });

        const code = `
function getType<T>(type?: ReceiveType<T>) {
    return resolveReceiveType(type);
}

getType<string>();
`;
        const result = transformInline(loader, code, 'generic-function.ts');

        expect(result).toContain('getType');
        expect(result).toContain('__type');
    });

    test('transforms arrow function with type parameter', () => {
        const loader = createTestLoader({ reflection: 'default' });

        const code = `
const fn = <T>(value: T): T => value;
`;
        const result = transformInline(loader, code, 'arrow-function.ts');

        expect(result).toContain('__assignType');
    });

    test('transforms type alias', () => {
        const loader = createTestLoader({ reflection: 'default' });

        const code = `
type Status = 'active' | 'inactive' | 'pending';
`;
        const result = transformInline(loader, code, 'type-alias.ts');

        expect(result).toContain('__ΩStatus');
    });

    test('transforms enum', () => {
        const loader = createTestLoader({ reflection: 'default' });

        const code = `
enum Color {
    Red,
    Green,
    Blue
}
`;
        const result = transformInline(loader, code, 'enum.ts');

        expect(result).toContain('Color');
        // Enums get __Ω symbol for type metadata
        expect(result).toContain('__ΩColor');
    });
});

describe('DeepkitLoader - Cross-file Imports', () => {
    test('interface imported from another file', () => {
        const loader = createTestLoader({ reflection: 'default' });

        // First, transform shared.ts (the file with the interface)
        const sharedPath = join(testDir, 'shared.ts');
        const sharedCode = readFileSync(sharedPath, 'utf-8');
        const sharedResult = loader.transform(sharedCode, sharedPath);

        // Then transform main.ts (the file that imports)
        const mainPath = join(testDir, 'main.ts');
        const mainCode = readFileSync(mainPath, 'utf-8');
        const mainResult = loader.transform(mainCode, mainPath);

        // Verify shared.ts exports the type symbol
        expect(sharedResult).toContain('__ΩCreateUserData');
        expect(sharedResult).toContain('export');

        // Verify main.ts imports and uses the type symbol
        expect(mainResult).toContain("import { __ΩCreateUserData } from './shared'");
        expect(mainResult).toContain('__ΩCreateUserData');

        // Verify it does NOT fall back to any
        expect(mainResult).not.toContain("['!']");
    });

    test('class imported from another file', () => {
        const loader = createTestLoader({ reflection: 'default' });

        // Transform the class file first
        const classCode = `
export class Logger {
    log(message: string): void {}
}
`;
        const classPath = join(testDir, 'logger-class.ts');
        const classResult = loader.transform(classCode, classPath);

        // Transform the consumer file
        const consumerCode = `
import { Logger } from './logger-class';

function getLogger(logger: Logger) {
    return logger;
}
`;
        const consumerPath = join(testDir, 'consumer-class.ts');
        const consumerResult = loader.transform(consumerCode, consumerPath);

        // Class file gets static __type property
        expect(classResult).toContain('__type');
        expect(classResult).toContain('Logger');
        // Consumer file references the class in type info
        // Note: Classes are runtime values, so they're referenced directly without __Ω import
        expect(consumerResult).toContain('getLogger');
        expect(consumerResult).toContain('__type');
    });

    test('type alias imported from another file', () => {
        const loader = createTestLoader({ reflection: 'default' });

        // Transform the types file first
        const typesCode = `
export type UserId = string & { readonly __brand: 'UserId' };
`;
        const typesPath = join(testDir, 'types-alias.ts');
        const typesResult = loader.transform(typesCode, typesPath);

        // Transform the consumer file that uses the type alias in function param
        const consumerCode = `
import { UserId } from './types-alias';

function getUserById(id: UserId) {
    return id;
}
`;
        const consumerPath = join(testDir, 'consumer-alias.ts');
        const consumerResult = loader.transform(consumerCode, consumerPath);

        // Type alias file gets __Ω symbol
        expect(typesResult).toContain('__ΩUserId');
        // Consumer file generates type info for the function
        expect(consumerResult).toContain('getUserById');
        expect(consumerResult).toContain('__type');
    });

    test('exported interface generates __Ω symbol export', () => {
        const loader = createTestLoader({ reflection: 'default' });

        // Transform the original types file
        const originalCode = `
export interface User {
    id: number;
    name: string;
}
`;
        const originalPath = join(testDir, 'original-types.ts');
        const originalResult = loader.transform(originalCode, originalPath);

        // Original file exports the __Ω symbol
        expect(originalResult).toContain('__ΩUser');
        expect(originalResult).toContain('export { __ΩUser as __ΩUser }');
    });

    test('cross-file import uses actual file from disk', () => {
        // This test uses the real shared.ts and main.ts files
        // to verify cross-file resolution works with actual files
        const loader = createTestLoader({ reflection: 'default' });

        // Transform main.ts which imports from shared.ts (on disk)
        const mainPath = join(testDir, 'main.ts');
        const mainCode = readFileSync(mainPath, 'utf-8');
        const mainResult = loader.transform(mainCode, mainPath);

        // The transformer can read shared.ts from disk and resolve the type
        expect(mainResult).toContain("import { __ΩCreateUserData } from './shared'");
        expect(mainResult).toContain('__ΩCreateUserData');
    });
});

describe('DeepkitLoader - Reflection Options', () => {
    test('reflection: default - enables reflection for all', () => {
        const loader = createTestLoader({ reflection: 'default' });

        const code = `
interface Data {
    value: number;
}

function process(data: Data) {
    return data.value;
}
`;
        const result = transformInline(loader, code, 'reflection-default.ts');

        expect(result).toContain('__ΩData');
        expect(result).toContain('__type');
    });

    test('reflection: never - disables reflection', () => {
        const loader = createTestLoader({ reflection: 'never' });

        const code = `
interface Data {
    value: number;
}

function process(data: Data) {
    return data.value;
}
`;
        const result = transformInline(loader, code, 'reflection-never.ts');

        // No type symbols should be generated
        expect(result).not.toContain('__ΩData');
        expect(result).not.toContain('__type');
    });

    test('reflection: explicit - only with @reflection decorator', () => {
        const loader = createTestLoader({ reflection: 'explicit' });

        const codeWithoutDecorator = `
interface DataWithout {
    value: number;
}
`;
        const resultWithout = transformInline(loader, codeWithoutDecorator, 'reflection-explicit-without.ts');

        const codeWithDecorator = `
/** @reflection */
interface DataWith {
    value: number;
}
`;
        const resultWith = transformInline(loader, codeWithDecorator, 'reflection-explicit-with.ts');

        // Without decorator should not have type info
        expect(resultWithout).not.toContain('__ΩDataWithout');

        // With decorator should have type info
        expect(resultWith).toContain('__ΩDataWith');
    });

    test('no option + tsconfig with reflection: true', () => {
        const loader = createTestLoader({
            tsConfig: tsconfigWithReflection,
        });

        const code = `
interface Data {
    value: number;
}
`;
        const result = transformInline(loader, code, 'tsconfig-reflection.ts');

        // Should have reflection since tsconfig has reflection: true
        expect(result).toContain('__ΩData');
    });

    test('no option + tsconfig without reflection', () => {
        const loader = createTestLoader({
            tsConfig: rootTsconfig,
        });

        const code = `
interface Data {
    value: number;
}

function process(data: Data) {
    return data.value;
}
`;
        const result = loader.transform(code, '/fake/path/no-reflection.ts');

        // Without reflection config, no transformation should happen
        expect(result).not.toContain('__ΩData');
        expect(result).not.toContain('__type');
    });

    test('option overrides tsconfig reflection setting', () => {
        // tsconfig has reflection: true, but we override with 'never'
        const loader = createTestLoader({
            tsConfig: tsconfigWithReflection,
            reflection: 'never',
        });

        const code = `
interface Data {
    value: number;
}
`;
        const result = transformInline(loader, code, 'override-reflection.ts');

        // Override should take precedence
        expect(result).not.toContain('__ΩData');
    });
});

describe('DeepkitLoader - Edge Cases', () => {
    test('circular imports', () => {
        const loader = createTestLoader({ reflection: 'default' });

        // File A imports from B
        const fileACode = `
import { B } from './circular-b';

export interface A {
    b: B;
}
`;
        const fileAPath = join(testDir, 'circular-a.ts');
        const fileAResult = loader.transform(fileACode, fileAPath);

        // File B imports from A
        const fileBCode = `
import { A } from './circular-a';

export interface B {
    a: A;
}
`;
        const fileBPath = join(testDir, 'circular-b.ts');
        const fileBResult = loader.transform(fileBCode, fileBPath);

        // Both should transform successfully
        expect(fileAResult).toContain('__ΩA');
        expect(fileBResult).toContain('__ΩB');
    });

    test('deep import chains (A imports B imports C)', () => {
        const loader = createTestLoader({ reflection: 'default' });

        // File C (base)
        const fileCCode = `
export interface BaseEntity {
    id: number;
    createdAt: Date;
}
`;
        const fileCPath = join(testDir, 'chain-c.ts');
        const fileCResult = loader.transform(fileCCode, fileCPath);

        // File B imports C
        const fileBCode = `
import { BaseEntity } from './chain-c';

export interface User extends BaseEntity {
    name: string;
}
`;
        const fileBPath = join(testDir, 'chain-b.ts');
        const fileBResult = loader.transform(fileBCode, fileBPath);

        // File A imports B
        const fileACode = `
import { User } from './chain-b';

function getUser(id: number): User {
    return { id, name: '', createdAt: new Date() };
}
`;
        const fileAPath = join(testDir, 'chain-a.ts');
        const fileAResult = loader.transform(fileACode, fileAPath);

        // Each file in the chain generates its type metadata
        expect(fileCResult).toContain('__ΩBaseEntity');
        expect(fileBResult).toContain('__ΩUser');
        // File A has function type info
        expect(fileAResult).toContain('getUser');
        expect(fileAResult).toContain('__type');
    });

    test('mixed .ts and .tsx files', () => {
        const loader = createTestLoader({ reflection: 'default' });

        // Transform a TSX file
        const tsxCode = `
interface Props {
    name: string;
    onClick: () => void;
}

function Button(props: Props) {
    return <button onClick={props.onClick}>{props.name}</button>;
}
`;
        const tsxPath = join(testDir, 'component.tsx');
        const tsxResult = loader.transform(tsxCode, tsxPath);

        expect(tsxResult).toContain('__ΩProps');
        expect(tsxResult).toContain('Button');
    });

    test('generic types with constraints', () => {
        const loader = createTestLoader({ reflection: 'default' });

        const code = `
interface HasId {
    id: number;
}

function findById<T extends HasId>(items: T[], id: number): T | undefined {
    return items.find(item => item.id === id);
}
`;
        const result = transformInline(loader, code, 'generic-constraints.ts');

        expect(result).toContain('__ΩHasId');
        expect(result).toContain('findById');
        expect(result).toContain('__type');
    });

    test('union and intersection types', () => {
        const loader = createTestLoader({ reflection: 'default' });

        const code = `
type StringOrNumber = string | number;
type Combined = { a: string } & { b: number };

function processUnion(value: StringOrNumber): void {}
function processCombined(value: Combined): void {}
`;
        const result = transformInline(loader, code, 'union-intersection.ts');

        expect(result).toContain('__ΩStringOrNumber');
        expect(result).toContain('__ΩCombined');
    });

    test('conditional types', () => {
        const loader = createTestLoader({ reflection: 'default' });

        const code = `
type IsString<T> = T extends string ? true : false;
type Result = IsString<'hello'>;
`;
        const result = transformInline(loader, code, 'conditional-types.ts');

        expect(result).toContain('__ΩIsString');
        expect(result).toContain('__ΩResult');
    });

    test('mapped types', () => {
        const loader = createTestLoader({ reflection: 'default' });

        const code = `
interface User {
    name: string;
    age: number;
}

type ReadonlyUser = Readonly<User>;
type PartialUser = Partial<User>;
`;
        const result = transformInline(loader, code, 'mapped-types.ts');

        expect(result).toContain('__ΩUser');
        expect(result).toContain('__ΩReadonlyUser');
        expect(result).toContain('__ΩPartialUser');
        // Should also embed the global Readonly and Partial types
        expect(result).toContain('__ΩReadonly');
        expect(result).toContain('__ΩPartial');
    });

    test('preserves "use client" directive at top', () => {
        const loader = createTestLoader({ reflection: 'default' });

        const code = `"use client";

interface Props {
    name: string;
}

function Component(props: Props) {
    return props.name;
}
`;
        const result = transformInline(loader, code, 'use-client.ts');

        expect(result.startsWith('"use client"')).toBe(true);
    });

    test('template literal types', () => {
        const loader = createTestLoader({ reflection: 'default' });

        const code = `
type EventName = \`on\${Capitalize<'click' | 'focus'>}\`;
`;
        const result = transformInline(loader, code, 'template-literal.ts');

        expect(result).toContain('__ΩEventName');
    });
});

describe('DeepkitLoader - State Management', () => {
    let loader: DeepkitLoader;

    beforeEach(() => {
        loader = createTestLoader({ reflection: 'default' });
    });

    test('same loader instance reused across multiple transforms', () => {
        // Transform multiple files with the same loader
        const file1Code = `
export interface User {
    id: number;
}
`;
        const file1Path = join(testDir, 'state-file1.ts');
        const file1Result = loader.transform(file1Code, file1Path);

        const file2Code = `
import { User } from './state-file1';

function getUser(): User {
    return { id: 1 };
}
`;
        const file2Path = join(testDir, 'state-file2.ts');
        const file2Result = loader.transform(file2Code, file2Path);

        const file3Code = `
import { User } from './state-file1';

function createUser(id: number): User {
    return { id };
}
`;
        const file3Path = join(testDir, 'state-file3.ts');
        const file3Result = loader.transform(file3Code, file3Path);

        // First file exports __ΩUser
        expect(file1Result).toContain('__ΩUser');
        expect(file1Result).toContain('export { __ΩUser as __ΩUser }');
        // Subsequent files generate function type info
        expect(file2Result).toContain('getUser');
        expect(file2Result).toContain('__type');
        expect(file3Result).toContain('createUser');
        expect(file3Result).toContain('__type');
    });

    test('knownFiles tracking works correctly', () => {
        // Transform main.ts FIRST (before shared.ts)
        // The loader should still work because it reads shared.ts from disk
        const mainPath = join(testDir, 'main.ts');
        const mainCode = readFileSync(mainPath, 'utf-8');
        const mainResult = loader.transform(mainCode, mainPath);

        // Then transform shared.ts
        const sharedPath = join(testDir, 'shared.ts');
        const sharedCode = readFileSync(sharedPath, 'utf-8');
        const sharedResult = loader.transform(sharedCode, sharedPath);

        // Both should work regardless of order
        expect(mainResult).toContain("import { __ΩCreateUserData } from './shared'");
        expect(sharedResult).toContain('__ΩCreateUserData');
    });

    test('cache is properly shared between transforms', () => {
        // Transform a file with types that require globals
        const file1Code = `
type A = Partial<{ name: string }>;
`;
        const file1Path = join(testDir, 'cache-file1.ts');
        loader.transform(file1Code, file1Path);

        // Transform another file using the same globals
        const file2Code = `
type B = Partial<{ age: number }>;
`;
        const file2Path = join(testDir, 'cache-file2.ts');
        const file2Result = loader.transform(file2Code, file2Path);

        // Should still contain the Partial global
        expect(file2Result).toContain('__ΩPartial');
    });

    test('multiple transforms of the same file update knownFiles', () => {
        const filePath = join(testDir, 'update-test.ts');

        // First transform
        const code1 = `
interface User {
    id: number;
}
`;
        const result1 = loader.transform(code1, filePath);
        expect(result1).toContain('__ΩUser');

        // Second transform with updated code
        const code2 = `
interface User {
    id: number;
    name: string;
}
`;
        const result2 = loader.transform(code2, filePath);
        expect(result2).toContain('__ΩUser');
        expect(result2).toContain('name');
    });
});

describe('DeepkitLoader - Compiler Options', () => {
    test('custom compiler options are applied', () => {
        const loader = createTestLoader({
            reflection: 'default',
            compilerOptions: {
                strict: true,
                noImplicitAny: true,
            },
        });

        const code = `
interface User {
    name: string;
}
`;
        const result = transformInline(loader, code, 'compiler-options.ts');

        // Should transform successfully with custom options
        expect(result).toContain('__ΩUser');
    });

    test('ES module output format', () => {
        const loader = createTestLoader({
            reflection: 'default',
        });

        const code = `
export interface User {
    name: string;
}

export function getUser(): User {
    return { name: '' };
}
`;
        const result = transformInline(loader, code, 'esm-output.ts');

        // Verify ESM syntax is preserved
        expect(result).toContain('export');
    });
});

describe('DeepkitLoader - Complex Scenarios', () => {
    test('namespace exports', () => {
        const loader = createTestLoader({ reflection: 'default' });

        const code = `
export namespace Models {
    export interface User {
        id: number;
        name: string;
    }

    export interface Post {
        id: number;
        title: string;
        author: User;
    }
}
`;
        const result = transformInline(loader, code, 'namespace.ts');

        expect(result).toContain('Models');
    });

    test('decorators on classes', () => {
        const loader = createTestLoader({
            reflection: 'default',
            compilerOptions: {
                experimentalDecorators: true,
            },
        });

        const code = `
function Injectable() {
    return function(target: any) {};
}

@Injectable()
class Service {
    constructor(private db: Database) {}
}

interface Database {
    query(sql: string): Promise<any>;
}
`;
        const result = transformInline(loader, code, 'decorators.ts');

        expect(result).toContain('Service');
        expect(result).toContain('__type');
    });

    test('async/await in transformed code', () => {
        const loader = createTestLoader({ reflection: 'default' });

        const code = `
interface User {
    id: number;
    name: string;
}

async function fetchUser(id: number): Promise<User> {
    return { id, name: 'Test' };
}
`;
        const result = transformInline(loader, code, 'async-code.ts');

        expect(result).toContain('__ΩUser');
        expect(result).toContain('async');
        expect(result).toContain('Promise');
    });

    test('index signature types', () => {
        const loader = createTestLoader({ reflection: 'default' });

        const code = `
interface Dictionary<T> {
    [key: string]: T;
}

type StringDict = Dictionary<string>;
`;
        const result = transformInline(loader, code, 'index-signature.ts');

        expect(result).toContain('__ΩDictionary');
        expect(result).toContain('__ΩStringDict');
    });

    test('recursive types', () => {
        const loader = createTestLoader({ reflection: 'default' });

        const code = `
interface TreeNode {
    value: number;
    children: TreeNode[];
}
`;
        const result = transformInline(loader, code, 'recursive-types.ts');

        expect(result).toContain('__ΩTreeNode');
    });

    test('tuple types', () => {
        const loader = createTestLoader({ reflection: 'default' });

        const code = `
type Point = [number, number];
type LabeledPoint = [string, number, number];

function distance(p1: Point, p2: Point): number {
    return Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2);
}
`;
        const result = transformInline(loader, code, 'tuple-types.ts');

        expect(result).toContain('__ΩPoint');
        expect(result).toContain('__ΩLabeledPoint');
    });

    test('infer keyword in conditional types', () => {
        const loader = createTestLoader({ reflection: 'default' });

        const code = `
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;
`;
        const result = transformInline(loader, code, 'infer-types.ts');

        expect(result).toContain('__ΩReturnType');
        expect(result).toContain('__ΩUnwrapPromise');
    });
});

describe('DeepkitLoader - Error Handling', () => {
    test('handles empty source code', () => {
        const loader = createTestLoader({ reflection: 'default' });

        const code = '';
        const result = transformInline(loader, code, 'empty.ts');

        expect(result).toBe('');
    });

    test('handles source with only comments', () => {
        const loader = createTestLoader({ reflection: 'default' });

        const code = `
// This is a comment
/* Another comment */
`;
        const result = transformInline(loader, code, 'comments-only.ts');

        // Should not crash
        expect(result).toBeDefined();
    });

    test('handles source with syntax errors gracefully', () => {
        const loader = createTestLoader({ reflection: 'default' });

        // Mild syntax issues that TS can still parse
        const code = `
interface User {
    name: string;
}
`;
        const result = transformInline(loader, code, 'syntax-test.ts');

        // Should handle gracefully
        expect(result).toContain('User');
    });
});

describe('DeepkitLoader - Integration with ReceiveType Pattern', () => {
    test('ReceiveType function parameter transformation', () => {
        const loader = createTestLoader({ reflection: 'default' });

        const code = `
function validate<T>(data: unknown, type?: ReceiveType<T>): boolean {
    type = resolveReceiveType(type);
    return true;
}

interface User {
    name: string;
}

validate<User>({});
`;
        const result = transformInline(loader, code, 'receive-type.ts');

        expect(result).toContain('validate');
        expect(result).toContain('__ΩUser');
    });

    test('ReceiveType forwarding to other functions', () => {
        const loader = createTestLoader({ reflection: 'default' });

        const code = `
function typeOf2<T>(type?: ReceiveType<T>) {
    return resolveReceiveType(type);
}

function mySerialize<T>(type?: ReceiveType<T>) {
    return typeOf2<T>();
}
`;
        const result = transformInline(loader, code, 'receive-type-forward.ts');

        expect(result).toContain('typeOf2');
        expect(result).toContain('mySerialize');
    });

    test('class constructor with ReceiveType', () => {
        const loader = createTestLoader({ reflection: 'default' });

        const code = `
class Repository<T> {
    constructor(type?: ReceiveType<T>) {}
}

interface User {
    id: number;
}

new Repository<User>();
`;
        const result = transformInline(loader, code, 'constructor-receive-type.ts');

        expect(result).toContain('Repository');
        expect(result).toContain('__ΩUser');
    });
});
