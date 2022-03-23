import * as ts from 'typescript';
import { expect, test } from '@jest/globals';
import { createDefaultMapFromNodeModules, createSystem, createVirtualCompilerHost } from "@typescript/vfs"
import { ReflectionTransformer, transformer } from '../src/compiler';
import { getPreEmitDiagnostics, TransformationContext } from 'typescript';

test('asd', () => {
    const compilerOptions: ts.CompilerOptions = {
        target: ts.ScriptTarget.ES2015,
        allowNonTsExtensions: true,
        module: ts.ModuleKind.CommonJS,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        experimentalDecorators: true,
        esModuleInterop: true,
    };
    const fsMap = createDefaultMapFromNodeModules({ target: ts.ScriptTarget.ES2015 })
    // const fsMap = new Map<string, string>()
    fsMap.set('index.ts', `
    import {PrimaryKey} from '@deepkit/type';

    class User {
        id: PrimaryKey & number = 0;
    }
    `);
    fsMap.set('/node_modules/@deepkit/type/index.d.ts', `
        export type PrimaryKey = {
            __meta?: ['primaryKey'];
        };
        export type __ΩPrimaryKey = any[];
    `);

    const system = createSystem(fsMap);
    fsMap.delete('/lib.webworker.d.ts'); //this throws type errors otherwise

    const host = createVirtualCompilerHost(system, compilerOptions, ts);

    // const fileExists = host.compilerHost.fileExists;
    // host.compilerHost.fileExists = fileName => {
    //     // console.log('fileExists', fileName);
    //     return fileExists(fileName);
    // };
    // const readFile = host.compilerHost.readFile;
    // host.compilerHost.readFile = fileName => {
    //     // console.log('readFile', fileName);
    //     return readFile(fileName);
    // };
    //
    // const getSourceFile = host.compilerHost.getSourceFile;
    // host.compilerHost.getSourceFile = (...args: any[]) => {
    //     const content = (getSourceFile as any)(...args);
    //     // console.log('getSourceFile', args, content);
    //     return content;
    // };

    const program = ts.createProgram({
        rootNames: [...fsMap.keys()],
        options: compilerOptions,
        host: host.compilerHost,
    });
    for (const d of getPreEmitDiagnostics(program)) {
        console.log('diagnostics', d.file?.fileName, d.messageText , d.start, d.length);
    }

    program.emit(undefined, undefined, undefined, undefined, {
        before: [(context: TransformationContext) => new ReflectionTransformer(context).withReflectionMode('always')],
    });

    const result = fsMap.get('index.js');

    console.log('generated', result);
    expect(result).toContain(`var { __ΩPrimaryKey } = require('@deepkit/type');`);
    expect(result).toContain(`User.__type = [() => __ΩPrimaryKey, 'id'`);
})
