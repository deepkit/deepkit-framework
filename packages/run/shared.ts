import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import * as ts from 'typescript';

import { declarationTransformer, transformer } from '@deepkit/type-compiler';

interface ProjectConfig {
    tsConfig: ts.CompilerOptions;
    packageType: 'module' | 'commonjs';
}

const configCache = new Map<string, ProjectConfig>();

function findProjectConfig(startPath: string): ProjectConfig {
    const dir = dirname(startPath);
    const cached = configCache.get(dir);
    if (cached) return cached;

    let tsConfigPath: string | undefined;
    let packageType: 'module' | 'commonjs' = 'commonjs';
    let foundPackageJson = false;

    // Walk all the way up to find both tsconfig.json and package.json
    let current = dir;
    while (current !== dirname(current)) {
        const tsConfigCandidate = join(current, 'tsconfig.json');
        const packageJsonCandidate = join(current, 'package.json');

        if (!tsConfigPath && existsSync(tsConfigCandidate)) {
            tsConfigPath = tsConfigCandidate;
        }
        if (!foundPackageJson && existsSync(packageJsonCandidate)) {
            foundPackageJson = true;
            try {
                const pkg = JSON.parse(readFileSync(packageJsonCandidate, 'utf8'));
                packageType = pkg.type === 'module' ? 'module' : 'commonjs';
            } catch {}
        }
        if (tsConfigPath && foundPackageJson) break;
        current = dirname(current);
    }

    let tsConfig: ts.CompilerOptions = {};
    if (tsConfigPath) {
        const configFile = ts.readConfigFile(tsConfigPath, p => readFileSync(p, 'utf8'));
        if (configFile.config) {
            const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, dirname(tsConfigPath));
            tsConfig = parsed.options;
        }
    }

    const config: ProjectConfig = {
        tsConfig: {
            ...tsConfig,
            target: ts.ScriptTarget.ES2022,
            configFilePath: tsConfigPath,
            sourceMap: true,
        },
        packageType,
    };

    configCache.set(dir, config);
    return config;
}

export function transpile(
    source: string,
    filename: string,
    format?: 'module' | 'commonjs',
): { output: string; format: 'module' | 'commonjs' } {
    const config = findProjectConfig(filename);
    const resolvedFormat = format ?? config.packageType;
    const moduleKind = resolvedFormat === 'module' ? ts.ModuleKind.ES2022 : ts.ModuleKind.CommonJS;

    const result = ts.transpileModule(source, {
        compilerOptions: { ...config.tsConfig, module: moduleKind },
        fileName: filename,
        transformers: {
            before: [transformer],
            afterDeclarations: [declarationTransformer],
        },
    });

    return { output: result.outputText, format: resolvedFormat };
}
