/** @reflection never */
import { describe, expect, test } from '@jest/globals';
import { CompilerOptions, createCompilerHost, createProgram, createSourceFile, CustomTransformerFactory, ModuleKind, ScriptTarget, SourceFile, transpileModule } from 'typescript';
import { transformer } from '../../src/transformer';

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

    const ori = {...host}
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

test('transpile single', () => {
    expect(transpile(`const p: string = '';`).trim()).toContain(`const p = '';`);
});

// test('transpile transformer', () => {
//     let foundDeclaration: Declaration | undefined;
//     const transformer: CustomTransformerFactory = (context: TransformationContext) => {
//         const deepkitTransformer = new DeepkitTransformer(context);
//         return (sourceFile) => {
//             deepkitTransformer.sourceFile = sourceFile;
//             const visitor = (node: Node): Node => {
//                 if (isPropertyDeclaration(node) && node.type) {
//                     const symbol = deepkitTransformer.findSymbol(node.type);
//                     if (symbol) {
//                         foundDeclaration = deepkitTransformer.findDeclaration(symbol);
//                     }
//                 }
//                 return visitEachChild(node, visitor, context);
//             };
//             return visitNode(sourceFile, visitor);
//         };
//     };
//     transpile({
//             app: `import {MyEnum} from './module'; class Controller {p: MyEnum;}`,
//             module: `export const enum MyEnum {}`
//         },
//         transformer
//     );
//     expect(foundDeclaration && isEnumDeclaration(foundDeclaration)).toBe(true);
// });

const tests: [code: string | { [file: string]: string }, contains: string | string[]][] = [
    [`class Config{}; const config = new Config; class Entity { p(c: typeof config) {}}`, ['t.type(t.any, t.forwardRef(() => config))']],
    [`class Entity { p(): number {}}`, ['t.number', `'../../src/decorators'`]],
    [`/** @reflection never */ class Entity { p(): number {}}`, ['!t.number']],
    [`class Entity { p(): number {}}`, 't.number'],

    [`class Entity { p(param: string): number {}}`, `t.number`],
    [`class Entity { p(param: string): number {}}`, `t.string.name('param')`],
    [`@t class Entity { constructor(param: string) {}}`, `t.string.name('param')`],
    [`import {bla} from 'module'; @injectable class Entity { constructor(param: string) {}}`, `t.string.name('param')`],

    [`class Entity { p(param: string): number {}}`, `t.string.name('param')`],
    [`class Entity { p(param: string) {} }`, `t.string.name('param')`],
    [`class Entity { @rpc p(param: string) {} }`, `t.string.name('param')`],
    [`class Entity { p(/** @reflection never */ param: string) {} }`, `!t.string.name('param')`],

    [`export type RpcExecutionSubscription = {id: number}; class Controller { public subscriptions: RpcExecutionSubscription[] = [];}`, '!RpcExecutionSubscription'],
    [`class Entity { p: number;}`, 't.number'],
    [`
    const p: string = '';
    /** @reflection never */
    function() {
        class Entity { p: number;}
    }`, '!t.number'],

    //Imported interfaces/types will be erased
    [{
        app: `import {Type} from './model'; class Entity { p: Type[];}`,
        model: `export type Type = {title: string}`
    }, ['!Type', `!./model`, `!import {Type} from './model'`]],
    [{
        app: `import {Message, Model} from './model'; class Entity { p: Message[]; m: Model[];}`,
        model: `export type Message = { event: 'outgoing', composite: boolean, messages: RpcEventMessage[] } & RpcEventMessage; export class Model {};`
    }, ['!Message', `import { Model } from './model'`, `t.array(t.type(t.forwardRef(() => Model)))`]],
    [{
        app: `import {Type} from './model'; class Entity { p: Type[];}`,
        model: `export interface Type {title: string}`
    }, ['!Type', `!./model`, `!import {Type} from './model'`]],

    [{
        app: `import {Type, Model} from './model'; class Entity { p: Type[]; p2: Model[]};`,
        model: `export interface Type {title: string}; export class Model {}`
    }, ['!Type', `import { Model } from './model'`, 't.array(t.type(t.forwardRef(() => Model)))']],

    //multiple exports can be resolved
    [{
        app: `import {Type, Model} from './myPackage'; class Entity { p: Type[]; p2: Model[]};`,
        myPackage: `export * from './myPackageModel';`,
        myPackageModel: `export interface Type {title: string}; export class Model {}`
    }, ['!Type', `import { Model } from './myPackage'`, 't.array(t.type(t.forwardRef(() => Model)))']],

    [{
        app: `import {Type, Model} from './myPackage'; class Entity { p: Type[]; p2: Model[]};`,
        myPackage: `export {Model, Type} from './myPackageModel';`,
        myPackageModel: `export interface Type {title: string}; export class Model {}`
    }, ['!Type', `import { Model } from './myPackage'`, 't.array(t.type(t.forwardRef(() => Model)))']],

    [{
        app: `import {Type, Model} from './myPackage'; class Entity { p: Type[]; p2: Model[]};`,
        myPackage: `export {MM as Model, TT as Type} from './myPackageModel';`,
        myPackageModel: `export interface TT {title: string}; export class MM {}`
    }, ['!Type', `import { Model } from './myPackage'`, 't.array(t.type(t.forwardRef(() => Model)))']],

    [`
    /** @reflection never */
    class Entity1 { p: number;}
    class Entity2 { p: string;}
    `, ['!t.number', 't.string']],

    //erasable types will be kept
    [{
        app: `import {Model} from './model'; class Entity { p: Model[];}`,
        model: `export class Model {}`
    }, ['t.type(t.forwardRef(() => Model))', `import { Model } from './model';`]],

    // manually defined stops emitting auto types
    [`class Entity { @t.map() p: number;}`, '!t.number'],
    [`class Entity { @t.string p: number;}`, '!t.number'],
    [`class Entity { @(t.string) p: number;}`, '!t.number'],
    [`class Entity { @t.number p: string;}`, '!t.string'],
    [`class Entity { @t.literal('asd') p: number;}`, '!t.number'],
    [`class Entity { @t.union('a') p: number;}`, '!t.number'],
    [`class Entity { @t.boolean p: number;}`, '!t.number'],
    [`class Entity { @t.map() p(): number;}`, '!t.number'],
    [`class Entity { @t.string p(): number;}`, '!t.number'],
    [`class Entity { @(t.string) p(): number;}`, '!t.number'],
    [`class Entity { @t.map(t.any).optional p?: FilterQuery<T>;}`, '!FilterQuery'],

    [`class Entity { p?: number;}`, 't.number.optional'],
    [`class Entity { p: string;}`, 't.string'],
    [`class Entity { p: boolean;}`, 't.boolean'],
    [`class Entity { p: Date;}`, 't.date'],
    [`class Entity { p: any;}`, 't.any'],
    [`class Entity { p: bigint;}`, 't.bigint'],
    [`class Entity { p: Promise<number>;}`, 't.promise(t.number)'],
    [`class Entity { p: Entity<number, string>;}`, 't.type(t.forwardRef(() => Entity)).generic(t.number, t.string)'],
    [`class Subject {}; class Entity { p: Promise<Subject<number>>;}`, 't.promise(t.type(t.forwardRef(() => Subject)).generic(t.number))'],
    [`class Model {}; class Entity { p: Partial<Model>;}`, 't.partial(t.type(t.forwardRef(() => Model)))'],
    [{
        app: `import {MyEnum} from './enum'; class Entity { p: MyEnum;}`,
        enum: `export enum MyEnum {}`
    }, 't.enum(t.forwardRef(() => MyEnum))'],
    [{
        app: `import {Model} from './model'; class Entity { p: Model;}`,
        model: `export class Model {}`
    }, 't.type(t.forwardRef(() => Model))'],
    [`function() {enum MyEnum {}; class Entity { p: MyEnum;} }`, 't.enum(t.forwardRef(() => MyEnum))'],
    [`class Entity { p: Uint8Array;}`, 't.type(Uint8Array)'],
    [`class Entity { p: ArrayBuffer;}`, 't.type(ArrayBuffer)'],
    [`class Model {} class Entity { p: Model;}`, 't.type(t.forwardRef(() => Model))'],
    [`class Entity { p: 'a';}`, `t.literal('a')`],
    [`class Entity { p: 'a' | 'b';}`, `t.union('a', 'b')`],
    [`class Entity { p: 'a' | 'b' | undefined;}`, `t.union('a', 'b').optional`],
    [`class Entity { p: 'a' | 'b' | null;}`, `t.union('a', 'b').nullable`],
    [`class Entity { p: number[];}`, 't.array(t.number)'],
    [`class Entity { p: (number|undefined)[];}`, 't.array(t.number.optional)'],
    [`class Entity { p: boolean[];}`, 't.array(t.boolean)'],
    [`class Entity { p: ('a' | 'b')[];}`, `t.array(t.union('a', 'b'))`],
    [`class Entity { p?: ('a' | 'b')[];}`, `t.array(t.union('a', 'b')).optional`],
    [`class Entity { p: {[name: string]: number};}`, `t.record(t.string, t.number)`],
    [`class Entity { p: {[name: string]: number|undefined};}`, `t.record(t.string, t.number.optional)`],
    [`class Entity { p: Record<string, number>;}`, `t.record(t.string, t.number)`],
    [`class Entity { p: Record<string, number|undefined>;}`, `t.record(t.string, t.number.optional)`],
    [`class Entity { p: Record<string, number|string>;}`, `t.record(t.string, t.union(t.number, t.string)`],
];

describe('transformer', () => {
    for (const entry of tests) {
        const [code, contains] = entry;
        const label = 'string' === typeof code ? code : code['app.ts'] || '';
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
