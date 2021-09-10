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
    transpileModule
} from 'typescript';
import { transformer } from '../../src/transformer';

Error.stackTraceLimit = 200;

const options: CompilerOptions = {
    experimentalDecorators: true,
    module: ModuleKind.CommonJS,
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
    const originalGetSourceFile = host.getSourceFile;
    host.getSourceFile = (fileName: string, languageVersion: ScriptTarget) => {
        return files[fileName] || originalGetSourceFile(fileName, languageVersion);
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
    [`class Config{}; const config = new Config; class Entity { p(c: typeof config) {}}`, ['decorators_1.t.type(decorators_1.t.any, decorators_1.t.forwardRef(() => config))']],
    [`class Entity { p(): number {}}`, ['decorators_1.t.number', `'../../src/decorators'`]],
    [`/** @reflection never */ class Entity { p(): number {}}`, ['!decorators_1.t.number']],
    [`class Entity { p(): number {}}`, 'decorators_1.t.number'],

    [`class Entity { p(param: string): number {}}`, `decorators_1.t.number`],
    [`class Entity { p(param: string): number {}}`, `decorators_1.t.string.name('param')`],
    [`@t class Entity { constructor(param: string) {}}`, `decorators_1.t.string.name('param')`],
    [`import {bla} from 'module'; @injectable class Entity { constructor(param: string) {}}`, `decorators_1.t.string.name('param')`],

    [`class Entity { p(param: string): number {}}`, `decorators_1.t.string.name('param')`],
    [`class Entity { p(param: string) {} }`, `decorators_1.t.string.name('param')`],
    [`class Entity { @rpc p(param: string) {} }`, `decorators_1.t.string.name('param')`],
    [`class Entity { p(/** @reflection never */ param: string) {} }`, `!decorators_1.t.string.name('param')`],

    [`class Entity { p: number;}`, 'decorators_1.t.number'],
    [`
    const p: string = '';
    /** @reflection never */
    function() {
        class Entity { p: number;}
    }`, '!decorators_1.t.number'],

    [`
    /** @reflection never */
    class Entity1 { p: number;}
    class Entity2 { p: string;}
    `, ['!decorators_1.t.number', 'decorators_1.t.string']],

    //erasable types will be kept
    [{
        app: `import {Model} from './model'; class Entity { p: Model[];}`,
        model: `export class Model {}`
    }, ['decorators_1.t.type(decorators_1.t.forwardRef(() => model_1.Model))', `const model_1 =`]],

    // manually defined stops emitting auto types
    [`class Entity { @t.map() p: number;}`, '!decorators_1.t.number'],
    [`class Entity { @t.string p: number;}`, '!decorators_1.t.number'],
    [`class Entity { @(t.string) p: number;}`, '!decorators_1.t.number'],
    [`class Entity { @t.number p: string;}`, '!decorators_1.t.string'],
    [`class Entity { @t.literal('asd') p: number;}`, '!decorators_1.t.number'],
    [`class Entity { @t.union('a') p: number;}`, '!decorators_1.t.number'],
    [`class Entity { @t.boolean p: number;}`, '!decorators_1.t.number'],
    [`class Entity { @t.map() p(): number;}`, '!decorators_1.t.number'],
    [`class Entity { @t.string p(): number;}`, '!decorators_1.t.number'],
    [`class Entity { @(t.string) p(): number;}`, '!decorators_1.t.number'],
    [`class Entity { @t.map(t.any).optional p?: FilterQuery<T>;}`, '!FilterQuery'],

    [`class Entity { p?: number;}`, 'decorators_1.t.number.optional'],
    [`class Entity { p: string;}`, 'decorators_1.t.string'],
    [`class Entity { p: boolean;}`, 'decorators_1.t.boolean'],
    [`class Entity { p: Date;}`, 'decorators_1.t.date'],
    [`class Entity { p: any;}`, 'decorators_1.t.any'],
    [`class Entity { p: bigint;}`, 'decorators_1.t.bigint'],
    [`class Entity { p: Promise<number>;}`, 'decorators_1.t.promise(decorators_1.t.number)'],
    [`class Entity { p: Entity<number, string>;}`, 'decorators_1.t.type(decorators_1.t.forwardRef(() => Entity)).generic(decorators_1.t.number, decorators_1.t.string)'],
    [`class Entity { p: Promise<Subject<number>>;}`, 'decorators_1.t.promise(decorators_1.t.type(decorators_1.t.forwardRef(() => Subject)).generic(decorators_1.t.number))'],
    [`class Model{}; class Entity { p: Partial<Model>;}`, 'decorators_1.t.partial(decorators_1.t.type(decorators_1.t.forwardRef(() => Model)))'],
    [{
        app: `import {MyEnum} from './enum'; class Entity { p: MyEnum;}`,
        enum: `export enum MyEnum {}`
    }, 'decorators_1.t.enum(decorators_1.t.forwardRef(() => enum_1.MyEnum))'],
    [{
        app: `import {Model} from './model'; class Entity { p: Model;}`,
        model: `export class Model {}`
    }, 'decorators_1.t.type(decorators_1.t.forwardRef(() => model_1.Model))'],
    [`function() {enum MyEnum {}; class Entity { p: MyEnum;} }`, 'decorators_1.t.enum(decorators_1.t.forwardRef(() => MyEnum))'],
    [`class Entity { p: Uint8Array;}`, 'decorators_1.t.type(decorators_1.t.forwardRef(() => Uint8Array))'],
    [`class Entity { p: ArrayBuffer;}`, 'decorators_1.t.type(decorators_1.t.forwardRef(() => ArrayBuffer))'],
    [`class Model {} class Entity { p: Model;}`, 'decorators_1.t.type(decorators_1.t.forwardRef(() => Model))'],
    [`class Entity { p: 'a';}`, `decorators_1.t.literal('a')`],
    [`class Entity { p: 'a' | 'b';}`, `decorators_1.t.union('a', 'b')`],
    [`class Entity { p: 'a' | 'b' | undefined;}`, `decorators_1.t.union('a', 'b').optional`],
    [`class Entity { p: 'a' | 'b' | null;}`, `decorators_1.t.union('a', 'b').nullable`],
    [`class Entity { p: number[];}`, 'decorators_1.t.array(decorators_1.t.number)'],
    [`class Entity { p: (number|undefined)[];}`, 'decorators_1.t.array(decorators_1.t.number.optional)'],
    [`class Entity { p: boolean[];}`, 'decorators_1.t.array(decorators_1.t.boolean)'],
    [`class Entity { p: ('a' | 'b')[];}`, `decorators_1.t.array(decorators_1.t.union('a', 'b'))`],
    [`class Entity { p?: ('a' | 'b')[];}`, `decorators_1.t.array(decorators_1.t.union('a', 'b')).optional`],
    [`class Entity { p: {[name: string]: number};}`, `decorators_1.t.record(decorators_1.t.string, decorators_1.t.number)`],
    [`class Entity { p: {[name: string]: number|undefined};}`, `decorators_1.t.record(decorators_1.t.string, decorators_1.t.number.optional)`],
    [`class Entity { p: Record<string, number>;}`, `decorators_1.t.record(decorators_1.t.string, decorators_1.t.number)`],
    [`class Entity { p: Record<string, number|undefined>;}`, `decorators_1.t.record(decorators_1.t.string, decorators_1.t.number.optional)`],
    [`class Entity { p: Record<string, number|string>;}`, `decorators_1.t.record(decorators_1.t.string, decorators_1.t.union(decorators_1.t.number, decorators_1.t.string)`],
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
