/**
 * This test file investigates GitHub issue #456:
 * "Receive types doesn't work in Vite when trying to resolve a type that was imported from another file."
 *
 * Tests the DeepkitLoader API which is used by Vite/Bun plugins.
 *
 * @see https://github.com/deepkit/deepkit-framework/issues/456
 */
import { readFileSync } from 'fs';
import { describe, test } from 'node:test';
import { join } from 'path';

import { expect } from '@deepkit/run/expect';

import { DeepkitLoader } from '../src/loader.js';

// Use the type tests' tsconfig which has reflection: true
const tsconfigWithReflection = join(__dirname, '../../type/tests/tsconfig.json');
// Use absolute path for test files to enable proper module resolution
const testDir = join(__dirname, 'vite-test-files');

describe('DeepkitLoader - Issue #456', () => {
    test('cross-file interface import works with tsconfig reflection', () => {
        // Test using tsconfig that has reflection: true
        const loader = new DeepkitLoader({
            tsConfig: tsconfigWithReflection,
        });

        // Step 1: Transform shared.ts (the file with the interface)
        const sharedPath = join(testDir, 'shared.ts');
        const sharedCode = readFileSync(sharedPath, 'utf-8');
        const sharedResult = loader.transform(sharedCode, sharedPath);
        console.log('=== shared.ts output (tsconfig reflection) ===');
        console.log(sharedResult);

        // Step 2: Transform main.ts (the file that imports and uses the interface)
        const mainPath = join(testDir, 'main.ts');
        const mainCode = readFileSync(mainPath, 'utf-8');
        const mainResult = loader.transform(mainCode, mainPath);
        console.log('=== main.ts output (tsconfig reflection) ===');
        console.log(mainResult);

        // Verify shared.ts exports the type symbol
        expect(sharedResult).toContain('__ΩCreateUserData');
        expect(sharedResult).toContain('export');

        // Verify main.ts imports and uses the type symbol
        expect(mainResult).toContain("import { __ΩCreateUserData } from './shared'");
        expect(mainResult).toContain('__ΩCreateUserData');

        // Verify it does NOT fall back to any
        expect(mainResult).not.toContain("['!']");
    });

    test('cross-file interface import works with reflection option override', () => {
        // Test using reflection: 'default' option (for simple projects without tsconfig setup)
        const loader = new DeepkitLoader({
            reflection: 'default',
        });

        // Step 1: Transform shared.ts
        const sharedPath = join(testDir, 'shared.ts');
        const sharedCode = readFileSync(sharedPath, 'utf-8');
        const sharedResult = loader.transform(sharedCode, sharedPath);
        console.log('=== shared.ts output (reflection override) ===');
        console.log(sharedResult);

        // Step 2: Transform main.ts
        const mainPath = join(testDir, 'main.ts');
        const mainCode = readFileSync(mainPath, 'utf-8');
        const mainResult = loader.transform(mainCode, mainPath);
        console.log('=== main.ts output (reflection override) ===');
        console.log(mainResult);

        // Verify it works
        expect(sharedResult).toContain('__ΩCreateUserData');
        expect(mainResult).toContain("import { __ΩCreateUserData } from './shared'");
    });

    test('local interface works with reflection option', () => {
        const loader = new DeepkitLoader({
            reflection: 'default',
        });

        const code = `
interface LocalData {
    readonly name: string;
}

function fn<T>(t?: ReceiveType<T>) {
    return resolveReceiveType(t);
}

fn<LocalData>();
`;
        const result = loader.transform(code, join(testDir, 'local.ts'));
        console.log('=== local.ts output ===');
        console.log(result);

        // Verify local type works
        expect(result).toContain('__ΩLocalData');
        expect(result).toContain('() => __ΩLocalData');
    });

    test('without reflection config, transformer does nothing', () => {
        // When no reflection option is set AND tsconfig doesn't have reflection,
        // the transformer does nothing - this explains the original issue
        const loader = new DeepkitLoader({
            // No reflection option, and no tsconfig with reflection
            tsConfig: join(__dirname, '../../../tsconfig.json'), // root tsconfig has no reflection
        });

        const code = `
interface LocalData {
    readonly name: string;
}

function fn<T>(t?: ReceiveType<T>) {
    return resolveReceiveType(t);
}

fn<LocalData>();
`;
        const result = loader.transform(code, '/fake/path/test.ts');
        console.log('=== Without reflection config ===');
        console.log(result);

        // Without reflection, no __Ω symbols are generated
        expect(result).not.toContain('__ΩLocalData');
        expect(result).not.toContain('__type');

        console.log('\nThis is what the issue reporter experienced - missing reflection config');
    });

    test('known files are tracked for cross-file resolution', () => {
        // The loader should track files it has seen, allowing resolution
        // even if files are processed in any order
        const loader = new DeepkitLoader({
            reflection: 'default',
        });

        // Transform main.ts FIRST (before shared.ts)
        // The loader should still work because it reads shared.ts from disk
        const mainPath = join(testDir, 'main.ts');
        const mainCode = readFileSync(mainPath, 'utf-8');
        const mainResult = loader.transform(mainCode, mainPath);

        // Then transform shared.ts
        const sharedPath = join(testDir, 'shared.ts');
        const sharedCode = readFileSync(sharedPath, 'utf-8');
        const sharedResult = loader.transform(sharedCode, sharedPath);

        console.log('=== Order independence test ===');
        console.log('main.ts (transformed first):', mainResult.includes('__ΩCreateUserData'));
        console.log('shared.ts (transformed second):', sharedResult.includes('__ΩCreateUserData'));

        // Both should work regardless of order
        expect(mainResult).toContain("import { __ΩCreateUserData } from './shared'");
        expect(sharedResult).toContain('__ΩCreateUserData');
    });
});
