import * as ts from 'typescript';
import { createSourceFile, getPreEmitDiagnostics, ScriptTarget, ScriptKind, TransformationContext } from 'typescript';
import { createFSBackedSystem, createVirtualCompilerHost, knownLibFilesForCompilerOptions } from '@typescript/vfs';
import { ReflectionTransformer } from '../src/lib/compiler.js';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';

const defaultLibLocation = dirname(require.resolve('typescript')) + '/'; //node_modules/typescript/lib/

function fullPath(fileName: string): string {
    return __dirname + '/' + fileName + (fileName.includes('.') ? '' : '.ts');
}

function readLibs(compilerOptions: ts.CompilerOptions, files: Map<string, string>) {
    const getLibSource = (name: string) => {
        return readFileSync(join(defaultLibLocation, name), 'utf8');
    };
    const libs = knownLibFilesForCompilerOptions(compilerOptions, ts);
    for (let lib of libs) {
        if (lib.startsWith('lib.webworker.d.ts')) continue; //dom and webworker can not go together
        files.set(defaultLibLocation + lib, getLibSource(lib));
    }
}

const defaultCompilerOptions = {
}

export function transform(files: Record<string, string>, options: ts.CompilerOptions = {}): Record<string, string> {
    const compilerOptions: ts.CompilerOptions = {
        ...defaultCompilerOptions,
        target: ts.ScriptTarget.ES2016,
        allowNonTsExtensions: true,
        module: ts.ModuleKind.CommonJS,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        experimentalDecorators: true,
        esModuleInterop: true,
        ...options
    };

    const fsMap = new Map<string, string>();
    const system = createFSBackedSystem(fsMap, __dirname, ts, defaultLibLocation);

    const host = createVirtualCompilerHost(system, compilerOptions, ts);

    const res: Record<string, string> = {};

    for (const [fileName, source] of Object.entries(files)) {
        const sourceFile = createSourceFile(fullPath(fileName), source, compilerOptions.target || ScriptTarget.ES2018, true, ScriptKind.TS);
        host.updateFile(sourceFile);
    }

    for (const fileName of Object.keys(files)) {
        const sourceFile = host.compilerHost.getSourceFile(fullPath(fileName), ScriptTarget.ES2022);
        if (!sourceFile) continue;
        const transform = ts.transform(sourceFile, [(context) => (node) => new ReflectionTransformer(context).forHost(host.compilerHost).withReflectionMode('always').transformSourceFile(node)]);
        const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
        const code = printer.printNode(ts.EmitHint.SourceFile, transform.transformed[0], transform.transformed[0]);
        res[fileName] = code;
    }

    return res;
}

/**
 * The first entry in files is executed as main script
 */
export function transpileAndRun(files: Record<string, string>, options: ts.CompilerOptions = {}): any {
    const source = transpile(files);
    console.log('transpiled', source);
    const first = Object.keys(files)[0];

    return eval(source[first]);
}

export function transpile(files: Record<string, string>, options: ts.CompilerOptions = {}): Record<string, string> {
    const compilerOptions: ts.CompilerOptions = {
        ...defaultCompilerOptions,
        target: ts.ScriptTarget.ES2015,
        allowNonTsExtensions: true,
        module: ts.ModuleKind.CommonJS,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        experimentalDecorators: true,
        esModuleInterop: true,
        skipLibCheck: true,
        ...options
    };

    const fsMap = new Map<string, string>();
    for (const [fileName, source] of Object.entries(files)) {
        fsMap.set(fullPath(fileName), source);
    }
    const system = createFSBackedSystem(fsMap, __dirname, ts, defaultLibLocation);

    const host = createVirtualCompilerHost(system, compilerOptions, ts);
    host.compilerHost.getDefaultLibLocation = () => defaultLibLocation;

    const rootNames = Object.keys(files).map(fileName => fullPath(fileName));
    const program = ts.createProgram({
        rootNames: rootNames,
        options: compilerOptions,
        host: host.compilerHost,
    });
    for (const d of getPreEmitDiagnostics(program)) {
        console.log('diagnostics', d.file?.fileName, d.messageText, d.start, d.length);
    }
    const res: Record<string, string> = {};

    program.emit(undefined, (fileName, data) => {
        res[fileName.slice(__dirname.length + 1).replace(/\.js$/, '')] = data;
    }, undefined, undefined, {
        before: [(context: TransformationContext) => new ReflectionTransformer(context).forHost(host.compilerHost).withReflectionMode('always')],
    });

    return res;
}
