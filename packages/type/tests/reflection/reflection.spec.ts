/** @reflection never */
import { describe, expect, test } from '@jest/globals';
import { CompilerOptions, createCompilerHost, createProgram, createSourceFile, CustomTransformerFactory, ModuleKind, ScriptTarget, SourceFile, transpileModule } from 'typescript';
import { pack, ReflectionOp, transformer } from '../../src/reflection';

Error.stackTraceLimit = 200;

const options: CompilerOptions = {
    experimentalDecorators: true,
    module: ModuleKind.ES2020,
    transpileOnly: true,
    target: ScriptTarget.ES2020,
};

function transpile(source: string | { [file: string]: string }, useTransformer: CustomTransformerFactory = transformer) {
    if ('string' === typeof source) {
        return transpileModule(source, {
            fileName: __dirname + '/module.ts',
            compilerOptions: options,
            transformers: { before: [transformer] }
        }).outputText;
    }

    const files: { [path: string]: SourceFile } = {};
    const appPath = __dirname + '/app.ts';
    if ('string' === typeof source) {
        files[appPath] = createSourceFile(appPath, source, ScriptTarget.ES2020);
    } else {
        for (const [file, src] of Object.entries(source)) {
            const filePath = file === 'app.ts' ? appPath : __dirname + '/' + file + '.ts';
            files[filePath] = createSourceFile(filePath, src, ScriptTarget.ES2020);
        }
    }

    let appTs = '';
    const host = createCompilerHost(options);
    host.writeFile = (fileName, data, writeByteOrderMark, onError, sourceFiles) => {
        if (fileName.endsWith('app.js')) appTs = data;
    };

    const ori = { ...host };
    host.getSourceFile = (fileName: string, languageVersion: ScriptTarget) => {
        return files[fileName] || ori.getSourceFile(fileName, languageVersion);
    };
    host.fileExists = (fileName: string) => {
        return !!files[fileName] || ori.fileExists(fileName);
    };

    const program = createProgram(Object.keys(files), options, host);
    program.emit(files[appPath], undefined, undefined, undefined, { before: [useTransformer] });
    return appTs;
}

const tests: [code: string | { [file: string]: string }, contains: string | string[]][] = [
    [`class Entity { p: string }`, `Entity.__type = { p: ${ReflectionOp.string} }`],
    [`class Entity { p?: string }`, `Entity.__type = { p: ${pack([ReflectionOp.string, ReflectionOp.optional])} }`],
    [`class Entity { p: string | undefined }`, `Entity.__type = { p: ${pack([ReflectionOp.union, ReflectionOp.string, ReflectionOp.undefined])} }`],
    [`class Entity { p: string | null }`, `Entity.__type = { p: ${pack([ReflectionOp.union, ReflectionOp.string, ReflectionOp.null])} }`],
    [`class Entity { p: number[] }`, `{ p: ${pack([ReflectionOp.array, ReflectionOp.number])} }`],
    [`class Entity { p: (number | string)[] }`, `{ p: ${pack([ReflectionOp.array, ReflectionOp.union, ReflectionOp.number, ReflectionOp.string])} }`],
    [`class Entity { p: number }`, `{ p: ${ReflectionOp.number} }`],
    [`class Entity { p: boolean }`, `{ p: ${ReflectionOp.boolean} }`],
    [`class Entity { p: bigint }`, `{ p: ${ReflectionOp.bigint} }`],
    [`class Entity { p: any }`, `{ p: ${ReflectionOp.any} }`],
    [`class Entity { p: Date }`, `{ p: ${ReflectionOp.date} }`],
    [`class Entity { p: Promise<number> }`, `{ p: ${pack([ReflectionOp.promise, ReflectionOp.number])} }`],
    [`class Entity { p: Entity<string, number> }`, `{ p: [() => Entity, ${pack([ReflectionOp.genericClass, ReflectionOp.string, ReflectionOp.number])}]`],
    [`class Entity { p: string | number }`, `{ p: ${pack([ReflectionOp.union, ReflectionOp.string, ReflectionOp.number])}`],
    [`class Entity { p: string | number; p2: string}`,
        [`{ p: ${pack([ReflectionOp.union, ReflectionOp.string, ReflectionOp.number])}`, `p2: ${pack([ReflectionOp.string])}`]],

    [`class Entity { p: Uint8Array }`, `{ p: ${pack([ReflectionOp.uint8Array])}`],
    [`class Model{}; class Entity { p: Model }`, `{ p: [() => Model, ${pack([ReflectionOp.class])}]`],

    [`class Entity { constructor(param: string) {} }`, `{ constructor: ${pack([ReflectionOp.function, ReflectionOp.string, ReflectionOp.any])}`],
    [`class Entity { p(param: string): void }`, `{ p: ${pack([ReflectionOp.function, ReflectionOp.string, ReflectionOp.void])}`],
    [`class Entity { p(param: string): any }`, `{ p: ${pack([ReflectionOp.function, ReflectionOp.string, ReflectionOp.any])}`],
    [`class Entity { p(param: string, size: number): void }`, `{ p: ${pack([ReflectionOp.function, ReflectionOp.string, ReflectionOp.number, ReflectionOp.void])}`],

    [`function() {enum MyEnum {}; class Entity { p: MyEnum;} }`, `{ p: [() => MyEnum, ${pack([ReflectionOp.enum])}]`],
    [`class Entity { p: Uint8Array;}`, `{ p: ${pack([ReflectionOp.uint8Array])}`],
    [`class Entity { p: ArrayBuffer;}`, `{ p: ${pack([ReflectionOp.arrayBuffer])}`],
    [`class Model {} class Entity { p: Model;}`, `{ p: [() => Model, ${pack([ReflectionOp.class])}]`],
    [`class Entity { p: 'a';}`, `{ p: ['a', ${pack([ReflectionOp.literal])}]`],
    [`class Entity { p: 'a' | 'b';}`, `{ p: ['a', 'b', ${pack([ReflectionOp.union, ReflectionOp.literal, ReflectionOp.literal])}]`],

    [`class Entity { p: 'a' | 'b' | undefined;}`, `{ p: ['a', 'b', ${pack([ReflectionOp.union, ReflectionOp.literal, ReflectionOp.literal, ReflectionOp.undefined])}]`],
    [`class Entity { p: 'a' | 'b' | null;}`, `{ p: ['a', 'b', ${pack([ReflectionOp.union, ReflectionOp.literal, ReflectionOp.literal, ReflectionOp.null])}]`],
    [`class Entity { p: ('a' | 'b')[];}`, `{ p: ['a', 'b', ${pack([ReflectionOp.array, ReflectionOp.union, ReflectionOp.literal, ReflectionOp.literal])}]`],
    [`class Entity { p?: ('a' | 'b')[];}`, `{ p: ['a', 'b', ${pack([ReflectionOp.array, ReflectionOp.optional, ReflectionOp.union, ReflectionOp.literal, ReflectionOp.literal])}]`],
    [`class Entity { p: {[name: string]: number};}`, `{ p: ${pack([ReflectionOp.record, ReflectionOp.string, ReflectionOp.number])}`],
    [`class Entity { p: {[name: string]: number|undefined};}`, `{ p: ${pack([ReflectionOp.record, ReflectionOp.string, ReflectionOp.union, ReflectionOp.number, ReflectionOp.undefined])}`],
    [`class Entity { p: {[name: number]: number};}`, `{ p: ${pack([ReflectionOp.record, ReflectionOp.number, ReflectionOp.number])}`],
    [`class Entity { p: Record<string, number>; }`, `{ p: ${pack([ReflectionOp.record, ReflectionOp.string, ReflectionOp.number])}`],
    [`class Entity { p: Record<string, number|undefined>;}`, `{ p: ${pack([ReflectionOp.record, ReflectionOp.string, ReflectionOp.union, ReflectionOp.number, ReflectionOp.undefined])}`],
    [`class Entity { p: Record<number, number>;`, `{ p: ${pack([ReflectionOp.record, ReflectionOp.number, ReflectionOp.number])}`],

    [{
        app: `import {MyEnum} from './enum'; class Entity { p: MyEnum;}`,
        enum: `export enum MyEnum {}`
    }, `{ p: [() => MyEnum, ${pack([ReflectionOp.enum])}] }`],
    [{
        app: `import {Model} from './model'; class Entity { p: Model;}`,
        model: `export class Model {}`
    }, `{ p: [() => Model, ${pack([ReflectionOp.class])}] }`],


    [`export type RpcExecutionSubscription = {id: number}; class Controller { public p: RpcExecutionSubscription[] = [];}`,
        [`!RpcExecutionSubscription`, `{ p: ${pack([ReflectionOp.array, ReflectionOp.typeAlias])} }`]],
    [`
    /** @reflection never */
    function() {
        class Entity { p: number;}
    }`, '!__type'],
    [`
    function() {
        class Entity {
            /** @reflection never */
            p: number;

            p2: number;
        }
    }`, `{ p2: ${pack([ReflectionOp.number])} }`],

    // Imported interfaces/types will be erased
    [{
        app: `import {Type} from './model'; class Entity { p: Type[];}`,
        model: `export type Type = {title: string}`
    }, ['!Type', `!./model`, `!import {Type} from './model'`]],
    [{
        app: `import {Message, Model} from './model'; class Entity { p: Message[]; m: Model[];}`,
        model: `export type Message = { event: 'outgoing', composite: boolean, messages: RpcEventMessage[] } & RpcEventMessage; export class Model {};`
    }, ['!Message', `import { Model } from './model'`, `{ p: ${pack([ReflectionOp.array, ReflectionOp.typeAlias])}, m: [() => Model, ${pack([ReflectionOp.array, ReflectionOp.class])}] }`]],
    [{
        app: `import {Type} from './model'; class Entity { p: Type[];}`,
        model: `export interface Type {title: string}`
    }, ['!Type', `!./model`, `!import {Type} from './model'`]],

    [{
        app: `import {Type, Model} from './model'; class Entity { p: Type[]; p2: Model[]};`,
        model: `export interface Type {title: string}; export class Model {}`
    }, ['!Type', `import { Model } from './model'`, `{ p: ${pack([ReflectionOp.array, ReflectionOp.interface])}, p2: [() => Model, ${pack([ReflectionOp.array, ReflectionOp.class])}] }`]],

    // multiple exports can be resolved
    [{
        app: `import {Type, Model} from './myPackage'; class Entity { p: Type[]; p2: Model[]};`,
        myPackage: `export * from './myPackageModel';`,
        myPackageModel: `export interface Type {title: string}; export class Model {}`
    }, ['!Type', `import { Model } from './myPackage'`, `{ p: ${pack([ReflectionOp.array, ReflectionOp.interface])}, p2: [() => Model, ${pack([ReflectionOp.array, ReflectionOp.class])}] }`]],

    [{
        app: `import {Type, Model} from './myPackage'; class Entity { p: Type[]; p2: Model[]};`,
        myPackage: `export {Model, Type} from './myPackageModel';`,
        myPackageModel: `export interface Type {title: string}; export class Model {}`
    }, ['!Type', `import { Model } from './myPackage'`, `{ p: ${pack([ReflectionOp.array, ReflectionOp.interface])}, p2: [() => Model, ${pack([ReflectionOp.array, ReflectionOp.class])}] }`]],

    [{
        app: `import {Type, Model} from './myPackage'; class Entity { p: Type[]; p2: Model[]};`,
        myPackage: `export {MM as Model, TT as Type} from './myPackageModel';`,
        myPackageModel: `export interface TT {title: string}; export class MM {}`
    }, ['!Type', `import { Model } from './myPackage'`, `{ p: ${pack([ReflectionOp.array, ReflectionOp.interface])}, p2: [() => Model, ${pack([ReflectionOp.array, ReflectionOp.class])}] }`]],

    [`
    /** @reflection never */
    class Entity1 { p: number;}
    class Entity2 { p: string;}
    `, [`!p: ${pack([ReflectionOp.number])}`, `p: ${pack([ReflectionOp.string])}`]],
    [`
    class Entity1 { p: number;}
    /** @reflection never */
    class Entity2 { p: string;}
    `, [`p: ${pack([ReflectionOp.number])}`, `!p: ${pack([ReflectionOp.string])}`]],

    //erasable types will be kept
    [{
        app: `import {Model} from './model'; class Entity { p: Model[];}`,
        model: `export class Model {}`
    }, [`p: [() => Model, ${pack([ReflectionOp.array, ReflectionOp.class])}]`, `import { Model } from './model';`]],

    [`const fn = (param: string): void {}`, `const fn = Object.assign((param) => { }, { __type: ${pack([ReflectionOp.function, ReflectionOp.string, ReflectionOp.void])} })`],
    [`const fn = (param: string) {}`, `const fn = Object.assign((param) => { }, { __type: ${pack([ReflectionOp.function, ReflectionOp.string, ReflectionOp.any])} })`],
    [`const fn = () {}`, `const fn = Object.assign(() => { }, { __type: ${pack([ReflectionOp.function, ReflectionOp.any])} })`],

    [`const fn = function () {}`, `const fn = Object.assign(function () { }, { __type: ${pack([ReflectionOp.function, ReflectionOp.any])} })`],
    [`function createFn() { return function() {} }`, `return Object.assign(function () { }, { __type: ${pack([ReflectionOp.function, ReflectionOp.any])} })`],

    [`class Entity { createFn() { return function(param: string) {} }}`,  `return Object.assign(function (param) { }, { __type: ${pack([ReflectionOp.function, ReflectionOp.string, ReflectionOp.any])} })`],

    [`function name() {}`, `function name() { }\nname.__type = ${pack([ReflectionOp.function, ReflectionOp.any])};`],

];

describe('transformer', () => {
    for (const entry of tests) {
        const [code, contains] = entry;
        const label = 'string' === typeof code ? code : code['app'] || '';
        test(`${contains}: ${label.slice(-40)}`, () => {
            const e = expect(transpile(code));
            for (const c of (Array.isArray(contains) ? contains : [contains])) {
                if (c.startsWith('!')) {
                    e.not.toContain(c.substr(1));
                } else {
                    e.toContain(c);
                }
            }
        });
    }
});
