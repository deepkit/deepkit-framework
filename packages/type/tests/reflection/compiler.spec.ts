/** @reflection never */
import { describe, expect, test } from '@jest/globals';
import {
    CompilerOptions,
    createCompilerHost,
    createProgram,
    createSourceFile,
    CustomTransformerFactory,
    ModuleKind,
    ScriptKind,
    ScriptTarget,
    SourceFile,
    TransformationContext,
    transpileModule
} from 'typescript';
import { pack, ReflectionOp, ReflectionTransformer, transformer } from '../../src/reflection/compiler';

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
            transformers: { before: [(context: TransformationContext) => new ReflectionTransformer(context).withReflectionMode('always')] }
        }).outputText;
    }

    const files: { [path: string]: SourceFile } = {};
    const appPath = __dirname + '/app.ts';
    if ('string' === typeof source) {
        files[appPath] = createSourceFile(appPath, source, ScriptTarget.ES2020, true, ScriptKind.TS);
    } else {
        for (const [file, src] of Object.entries(source)) {
            const filePath = file === 'app.ts' ? appPath : __dirname + '/' + file + '.ts';
            files[filePath] = createSourceFile(filePath, src, ScriptTarget.ES2020, true, ScriptKind.TS);
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
    program.emit(files[appPath], undefined, undefined, undefined, { before: [(context: TransformationContext) => new ReflectionTransformer(context).withReflectionMode('always')] });
    return appTs;
}

function packString(...args: Parameters<typeof pack>): string {
    return `'${pack(...args)}'`;
}

const tests: [code: string | { [file: string]: string }, contains: string | string[]][] = [
    // [`class Entity { p: string }`, `Entity.__type = { p: ${packString([ReflectionOp.string])} }`],
    // [`class Entity { p?: string }`, `Entity.__type = { p: ${packString([ReflectionOp.string, ReflectionOp.optional])} }`],
    // [`class Entity { p: string | undefined }`, `Entity.__type = { p: ${packString([ReflectionOp.string, ReflectionOp.undefined, ReflectionOp.union2])} }`],
    // [`class Entity { p: string | null }`, `Entity.__type = { p: ${packString([ReflectionOp.string, ReflectionOp.null, ReflectionOp.union2])} }`],
    // [`class Entity { p: number[] }`, `{ p: ${packString([ReflectionOp.number, ReflectionOp.array])} }`],
    // [`class Entity { p: (number | string)[] }`, `{ p: ${packString([ReflectionOp.number, ReflectionOp.string, ReflectionOp.union2, ReflectionOp.array])} }`],
    // [`class Entity { p: number }`, `{ p: ${packString([ReflectionOp.number])} }`],
    // [`class Entity { p: boolean }`, `{ p: ${packString([ReflectionOp.boolean])} }`],
    // [`class Entity { p: bigint }`, `{ p: ${packString([ReflectionOp.bigint])} }`],
    // [`class Entity { p: any }`, `{ p: ${packString([ReflectionOp.any])} }`],
    // [`class Entity { p: Date }`, `{ p: ${packString([ReflectionOp.date])} }`],
    // [`class Entity { private p: string }`, `{ p: ${packString([ReflectionOp.string, ReflectionOp.private])} }`],
    // [`class Entity { p: Promise<number> }`, `{ p: ${packString([ReflectionOp.number, ReflectionOp.promise])} }`],
    // [`class Entity { p: Entity<string, number> }`, `{ p: [() => Entity, ${packString([ReflectionOp.string, ReflectionOp.number, ReflectionOp.class])}]`],
    // [`class Entity { p: string | number }`, `{ p: ${packString([ReflectionOp.string, ReflectionOp.number, ReflectionOp.union2])}`],
    // [`class Book {}; class IdentifiedReference<T> {} class Entity { p: IdentifiedReference<Book> }`, `{ p: [() => IdentifiedReference, () => Book, ${packString([ReflectionOp.class, ReflectionOp.class])}`],
    // [`class Entity { p: string | number; p2: string}`,
    //     [`{ p: ${packString([ReflectionOp.string, ReflectionOp.number, ReflectionOp.union2])}`, `p2: ${packString([ReflectionOp.string])}`]],

    // [`class Entity { p: Uint8Array }`, `{ p: ${packString([ReflectionOp.uint8Array])}`],
    // [`class Model{}; class Entity { p: Model }`, `{ p: [() => Model, ${packString([ReflectionOp.class])}]`],

    // [`class Entity { constructor(param: string) {} }`, `{ constructor: ${packString([ReflectionOp.string, ReflectionOp.any, ReflectionOp.method])}`],
    // [`class Entity { p(param: string): void }`, `{ p: ${packString([ReflectionOp.string, ReflectionOp.void, ReflectionOp.method])}`],
    // [`class Entity { p(param: string): any }`, `{ p: ${packString([ReflectionOp.string, ReflectionOp.any, ReflectionOp.method])}`],
    // [`class Entity { p(param: string, size: number): void }`, `{ p: ${packString([ReflectionOp.string, ReflectionOp.number, ReflectionOp.void, ReflectionOp.method])}`],

    // [`function f() {enum MyEnum {}; class Entity { p: MyEnum;} }`, `{ p: [() => MyEnum, ${packString([ReflectionOp.enum])}]`],
    // [`class Entity { p: Uint8Array;}`, `{ p: ${packString([ReflectionOp.uint8Array])}`],
    // [`class Entity { p: ArrayBuffer;}`, `{ p: ${packString([ReflectionOp.arrayBuffer])}`],
    // [`class Model {} class Entity { p: Model;}`, `{ p: [() => Model, ${packString([ReflectionOp.class])}]`],
    // [`class Entity { p: 'a';}`, `{ p: ['a', ${packString([ReflectionOp.literal, 0])}]`],
    // [`class Entity { p: 'a' | 'b';}`, `{ p: ['a', 'b', ${packString([ReflectionOp.literal, 0, ReflectionOp.literal, 1, ReflectionOp.union2])}]`],
    //
    // [`class Entity { p: 'a' | 'b' | undefined;}`, `{ p: ['a', 'b', ${packString([ReflectionOp.literal, 0, ReflectionOp.literal, 1, ReflectionOp.undefined, ReflectionOp.union3])}]`],
    // [`class Entity { p: 'a' | 'b' | 'c' | undefined;}`, `{ p: ['a', 'b', 'c', ${packString([ReflectionOp.frame, ReflectionOp.literal, 0, ReflectionOp.literal, 1, ReflectionOp.literal, 2, ReflectionOp.undefined, ReflectionOp.frameUnion])}]`],
    // [`class Entity { p: 'a' | 'b' | null;}`, `{ p: ['a', 'b', ${packString([ReflectionOp.literal, 0, ReflectionOp.literal, 1, ReflectionOp.null, ReflectionOp.union3])}]`],
    // [`class Entity { p: ('a' | 'b')[];}`, `{ p: ['a', 'b', ${packString([ReflectionOp.literal, 0, ReflectionOp.literal, 1, ReflectionOp.union2, ReflectionOp.array])}]`],
    // [`class Entity { p?: ('a' | 'b')[];}`, `{ p: ['a', 'b', ${packString([ReflectionOp.literal, 0, ReflectionOp.literal, 1, ReflectionOp.union2, ReflectionOp.array, ReflectionOp.optional])}]`],
    // [`class Entity { p: {[name: string]: number};}`, `{ p: ${packString([ReflectionOp.string, ReflectionOp.number, ReflectionOp.indexSignature, ReflectionOp.objectLiteral])}`],
    // [`class Entity { p: {[name: string]: number|undefined};}`, `{ p: ${packString([ReflectionOp.string, ReflectionOp.number, ReflectionOp.undefined, ReflectionOp.union2, ReflectionOp.indexSignature, ReflectionOp.objectLiteral])}`],
    // [`class Entity { p: {[name: number]: number};}`, `{ p: ${packString([ReflectionOp.number, ReflectionOp.number, ReflectionOp.indexSignature, ReflectionOp.objectLiteral])}`],

    //todo: Record is just an alias to an indexSignature in a ObjectLiteral
    // [`class Entity { p: Record<string, number>; }`, `{ p: ${packString([ReflectionOp.objectLiteral, ReflectionOp.indexSignature, ReflectionOp.string, ReflectionOp.number])}`],
    // [`class Entity { p: Record<string, number|undefined>;}`, `{ p: ${packString([ReflectionOp.objectLiteral, ReflectionOp.indexSignature, ReflectionOp.string, ReflectionOp.union, ReflectionOp.number, ReflectionOp.undefined])}`],
    // [`class Entity { p: Record<number, number>;`, `{ p: ${packString([ReflectionOp.objectLiteral, ReflectionOp.indexSignature, ReflectionOp.number, ReflectionOp.number])}`],

    // [{
    //     app: `import {MyEnum} from './enum'; class Entity { p: MyEnum;}`,
    //     enum: `export enum MyEnum {}`
    // }, `{ p: [() => MyEnum, ${packString([ReflectionOp.enum])}] }`],

    // [{
    //     app: `import {Model} from './model'; class Entity { p: Model;}`,
    //     model: `export class Model {}`
    // }, `{ p: [() => Model, ${packString([ReflectionOp.class])}] }`],

    // [`export interface MyInterface {id: number}; class Controller { public p: MyInterface[] = [];}`,
    //     [`!RpcExecutionSubscription`, `{ p: ['id', ${packString([ReflectionOp.number, ReflectionOp.propertySignature, 0, ReflectionOp.objectLiteral, ReflectionOp.array])}] }`]
    // ],

    // [`interface Base {title: string} interface MyInterface extends Base {id: number} class Controller { public p: MyInterface[] = [];}`,
    //     [`!MyInterface`, `!Base`, `{ p: ['id', 'title', ${packString([ReflectionOp.number, ReflectionOp.propertySignature, 0, ReflectionOp.string, ReflectionOp.propertySignature, 1, ReflectionOp.objectLiteral, ReflectionOp.array])}] }`]
    // ],

    // [`export type RpcExecutionSubscription = {id: number}; class Controller { public p: RpcExecutionSubscription[] = [];}`,
    //     [`!RpcExecutionSubscription`, `{ p: ['id', ${packString([ReflectionOp.number, ReflectionOp.propertySignature, 0, ReflectionOp.objectLiteral, ReflectionOp.array])}] }`]
    // ],

    // [`export type MyAlias = string; class Controller { public p: MyAlias[] = [];}`,
    //     [`!MyAlias`, `{ p: ${packString([ReflectionOp.string, ReflectionOp.array])} }`]
    // ],

    // [`
    // /** @reflection never */
    // function() {
    //     class Entity { p: number;}
    // }`, '!__type'],
    // [`
    // function() {
    //     class Entity {
    //         /** @reflection never */
    //         p: number;
    //
    //         p2: number;
    //     }
    // }`, `{ p2: ${packString([ReflectionOp.number])} }`],

    // Imported interfaces/types will be erased
    // [{
    //     app: `import {Type} from './model'; class Entity { p: Type[];}`,
    //     model: `export type Type = {title: string}`
    // }, ['!Type', `!./model`, `!import {Type} from './model'`]],

    [{
        app: `import {Message, Model} from './model'; class Entity { p: Message[]; m: Model[];}`,
        model: `export type Message = number; export class Model {};`
    }, ['!Message', `import { Model } from './model'`, `{ p: ${packString([ReflectionOp.number, ReflectionOp.array])}, m: [() => Model, ${packString([ReflectionOp.class, ReflectionOp.array])}] }`]],

    [{
        app: `import {Type} from './model'; class Entity { p: Type[];}`,
        model: `export interface Type {title: string}`
    }, ['!Type', `!./model`, `!import {Type} from './model'`]],

    //todo: this is wrong, we materialize interfaces
    // [{
    //     app: `import {Type, Model} from './model'; class Entity { p: Type[]; p2: Model[]};`,
    //     model: `export interface Type {title: string}; export class Model {}`
    // }, ['!Type', `import { Model } from './model'`, `{ p: ${packString([ReflectionOp.array, ReflectionOp.interface])}, p2: [() => Model, ${packString([ReflectionOp.array, ReflectionOp.class])}] }`]],

    // // multiple exports can be resolved
    // [{
    //     app: `import {Type, Model} from './myPackage'; class Entity { p: Type[]; p2: Model[]};`,
    //     myPackage: `export * from './myPackageModel';`,
    //     myPackageModel: `export interface Type {title: string}; export class Model {}`
    // }, ['!Type', `import { Model } from './myPackage'`, `{ p: ${packString([ReflectionOp.array, ReflectionOp.interface])}, p2: [() => Model, ${packString([ReflectionOp.array, ReflectionOp.class])}] }`]],
    //
    // [{
    //     app: `import {Type, Model} from './myPackage'; class Entity { p: Type[]; p2: Model[]};`,
    //     myPackage: `export {Model, Type} from './myPackageModel';`,
    //     myPackageModel: `export interface Type {title: string}; export class Model {}`
    // }, ['!Type', `import { Model } from './myPackage'`, `{ p: ${packString([ReflectionOp.array, ReflectionOp.interface])}, p2: [() => Model, ${packString([ReflectionOp.array, ReflectionOp.class])}] }`]],
    //
    // [{
    //     app: `import {Type, Model} from './myPackage'; class Entity { p: Type[]; p2: Model[]};`,
    //     myPackage: `export {MM as Model, TT as Type} from './myPackageModel';`,
    //     myPackageModel: `export interface TT {title: string}; export class MM {}`
    // }, ['!Type', `import { Model } from './myPackage'`, `{ p: ${packString([ReflectionOp.array, ReflectionOp.interface])}, p2: [() => Model, ${packString([ReflectionOp.array, ReflectionOp.class])}] }`]],
    //
    // [`
    // /** @reflection never */
    // class Entity1 { p: number;}
    // class Entity2 { p: string;}
    // `, [`!p: ${packString([ReflectionOp.number])}`, `p: ${packString([ReflectionOp.string])}`]],
    // [`
    // class Entity1 { p: number;}
    // /** @reflection never */
    // class Entity2 { p: string;}
    // `, [`p: ${packString([ReflectionOp.number])}`, `!p: ${packString([ReflectionOp.string])}`]],
    //
    // //erasable types will be kept
    // [{
    //     app: `import {Model} from './model'; class Entity { p: Model[];}`,
    //     model: `export class Model {}`
    // }, [`p: [() => Model, ${packString([ReflectionOp.array, ReflectionOp.class])}]`, `import { Model } from './model';`]],
    //
    // [`const fn = (param: string): void {}`, `const fn = Object.assign((param) => { }, { __type: ${packString([ReflectionOp.function, ReflectionOp.string, ReflectionOp.void])} })`],
    // [`const fn = (param: string) {}`, `const fn = Object.assign((param) => { }, { __type: ${packString([ReflectionOp.function, ReflectionOp.string, ReflectionOp.any])} })`],
    // [`const fn = () {}`, `!__type:`],
    // [`const fn = (): any {}`, `const fn = Object.assign(() => { }, { __type: ${packString([ReflectionOp.function, ReflectionOp.any])} })`],
    //
    // [`const fn = function () {}`, `!__type`],
    // [`const fn = function (): any {}`, `const fn = Object.assign(function () { }, { __type: ${packString([ReflectionOp.function, ReflectionOp.any])} })`],
    // [`function createFn() { return function() {} }`, `!__type`],
    // [`function createFn() { return function(): any {} }`, `return Object.assign(function () { }, { __type: ${packString([ReflectionOp.function, ReflectionOp.any])} })`],
    //
    // [`class Entity { createFn() { return function(param: string) {} }}`,  `return Object.assign(function (param) { }, { __type: ${packString([ReflectionOp.function, ReflectionOp.string, ReflectionOp.any])} })`],
    //
    // [`function name(): any {}`, `function name() { }\nname.__type = ${packString([ReflectionOp.function, ReflectionOp.any])};`],
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

test('no double __type', () => {
    expect(transpile(`function f() {enum MyEnum {} class Entity { p: MyEnum;} }`)).toBe(`function f() { let MyEnum; (function (MyEnum) {
})(MyEnum || (MyEnum = {}));  class Entity {
} Entity.__type = { p: [() => MyEnum, 'w'] }; }\n`);
});

test('type reference to global', () => {
    expect(transpile(`
        class Model {}

        class A {
            b: Partial<Model>;
        }
    `)).toContain('todo');
});
