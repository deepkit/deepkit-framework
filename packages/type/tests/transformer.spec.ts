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
import { transformer } from '../src/transformer';

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
            compilerOptions: options,
            transformers: { before: [transformer] }
        }).outputText;
    }

    const files: { [path: string]: SourceFile } = {};
    if ('string' === typeof source) {
        files['app.ts'] = createSourceFile('app.ts', source, ScriptTarget.ES2020, true, ScriptKind.TS);
    } else {
        for (const [file, src] of Object.entries(source)) {
            files[file + '.ts'] = createSourceFile(file + '.ts', src, ScriptTarget.ES2020, true, ScriptKind.TS);
        }
    }

    let appTs = '';
    const host = createCompilerHost(options);
    host.writeFile = (fileName, data, writeByteOrderMark, onError, sourceFiles) => {
        if (fileName === 'app.js') appTs = data;
    };
    const originalGetSourceFile = host.getSourceFile;
    host.getSourceFile = (fileName: string, languageVersion: ScriptTarget) => {
        return files[fileName] || originalGetSourceFile(fileName, languageVersion);
    };

    const program = createProgram(Object.keys(files), options, host);
    program.emit(files['app.ts'], undefined, undefined, undefined, { before: [useTransformer] });
    return appTs;
}

test('transpile single', () => {
    expect(transpile(`const p: string = '';`).trim()).toBe(`const p = '';`);
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
    [`import {t} from '@deepkit/type'; class Entity { @t p(): number {}}`, 'type_1.t.number'],
    [`import {t} from '@deepkit/type'; class Entity { @t p(param: string): number {}}`, `type_1.t.number`],
    [`import {t} from '@deepkit/type'; class Entity { @t p(param: string): number {}}`, `type_1.t.string.name('param')`],
    [`import {t} from '@deepkit/type'; @t class Entity { constructor(param: string) {}}`, `type_1.t.string.name('param')`],
    [`import {bla} from 'module'; @injectable class Entity { constructor(param: string) {}}`, `type_1.t.string.name('param')`],

    [`import {t} from '@deepkit/type'; class Entity { @t p(param: string): number {}}`, `type_1.t.string.name('param')`],
    [`import {t} from '@deepkit/type'; class Entity { @t p(param: string) {} }`, `type_1.t.string.name('param')`],
    [`class Entity { @rpc p(param: string) {} }`, `type_1.t.string.name('param')`],
    [`class Entity { p(param: string) {} }`, `!type_1.t.string.name('param')`],

    [`import {t} from '@deepkit/type'; class Entity { @t p: number;}`, 'type_1.t.number'],

    //erasable types will be kept
    [{
        app: `import {Model} from './model'; class Entity { @t p: Model[];}`,
        model: `export class Model {}`
    }, ['type_1.t.type(model_1.Model)', `const model_1 =`]],

    // manually defined @t stops emitting auto types
    [`import {t} from '@deepkit/type'; class Entity { @t.map() p: number;}`, '!type_1.t.number'],
    [`import {t} from '@deepkit/type'; class Entity { @t.string p: number;}`, '!type_1.t.number'],
    [`import {t} from '@deepkit/type'; class Entity { @(t.string) p: number;}`, '!type_1.t.number'],
    [`import {t} from '@deepkit/type'; class Entity { @t.number p: string;}`, '!type_1.t.string'],
    [`import {t} from '@deepkit/type'; class Entity { @t.literal('asd') p: number;}`, '!type_1.t.number'],
    [`import {t} from '@deepkit/type'; class Entity { @t.union('a') p: number;}`, '!type_1.t.number'],
    [`import {t} from '@deepkit/type'; class Entity { @t.boolean p: number;}`, '!type_1.t.number'],
    [`import {t} from '@deepkit/type'; class Entity { @t.map() p(): number;}`, '!type_1.t.number'],
    [`import {t} from '@deepkit/type'; class Entity { @t.string p(): number;}`, '!type_1.t.number'],
    [`import {t} from '@deepkit/type'; class Entity { @(t.string) p(): number;}`, '!type_1.t.number'],
    [`import {t} from '@deepkit/type'; class Entity { @t.map(t.any).optional p?: FilterQuery<T>;}`, '!FilterQuery'],

    [`import {t} from '@deepkit/type'; class Entity { @t p?: number;}`, 'type_1.t.number.optional'],
    [`import {t} from '@deepkit/type'; class Entity { @t p: string;}`, 'type_1.t.string'],
    [`import {t} from '@deepkit/type'; class Entity { @t p: boolean;}`, 'type_1.t.boolean'],
    [`import {t} from '@deepkit/type'; class Entity { @t p: Date;}`, 'type_1.t.date'],
    [`import {t} from '@deepkit/type'; class Entity { @t p: any;}`, 'type_1.t.any'],
    [`import {t} from '@deepkit/type'; class Entity { @t p: bigint;}`, 'type_1.t.bigint'],
    [`import {t} from '@deepkit/type'; class Entity { @t p: Promise<number>;}`, 'type_1.t.promise(type_1.t.number)'],
    [`import {t} from '@deepkit/type'; class Entity { @t p: Entity<number, string>;}`, 'type_1.t.type(Entity).generic(type_1.t.number, type_1.t.string)'],
    [`import {t} from '@deepkit/type'; class Entity { @t p: Promise<Subject<number>>;}`, 'type_1.t.promise(type_1.t.type(Subject).generic(type_1.t.number))'],
    [`import {t} from '@deepkit/type'; class Model{}; class Entity { @t p: Partial<Model>;}`, 'type_1.t.partial(Model)'],
    [{
        app: `import {t} from '@deepkit/type'; import {MyEnum} from './enum'; class Entity { @t p: MyEnum;}`,
        enum: `export enum MyEnum {}`
    }, 'type_1.t.enum(enum_1.MyEnum)'],
    [{
        app: `import {t} from '@deepkit/type'; import {Model} from './model'; class Entity { @t p: Model;}`,
        model: `export class Model {}`
    }, 'type_1.t.type(model_1.Model)'],
    [`import {t} from '@deepkit/type'; function() {enum MyEnum {}; class Entity { @t p: MyEnum;} }`, 'type_1.t.enum(MyEnum)'],
    [`import {t} from '@deepkit/type'; class Entity { @t p: Uint8Array;}`, 'type_1.t.type(Uint8Array)'],
    [`import {t} from '@deepkit/type'; class Entity { @t p: ArrayBuffer;}`, 'type_1.t.type(ArrayBuffer)'],
    [`import {t} from '@deepkit/type'; class Model {} class Entity { @t p: Model;}`, 'type_1.t.type(Model)'],
    [`import {t} from '@deepkit/type'; class Entity { @t p: 'a';}`, `type_1.t.literal('a')`],
    [`import {t} from '@deepkit/type'; class Entity { @t p: 'a' | 'b';}`, `type_1.t.union('a', 'b')`],
    [`import {t} from '@deepkit/type'; class Entity { @t p: 'a' | 'b' | undefined;}`, `type_1.t.union('a', 'b').optional`],
    [`import {t} from '@deepkit/type'; class Entity { @t p: 'a' | 'b' | null;}`, `type_1.t.union('a', 'b').nullable`],
    [`import {t} from '@deepkit/type'; class Entity { @t p: number[];}`, 'type_1.t.array(type_1.t.number)'],
    [`import {t} from '@deepkit/type'; class Entity { @t p: (number|undefined)[];}`, 'type_1.t.array(type_1.t.number.optional)'],
    [`import {t} from '@deepkit/type'; class Entity { @t p: boolean[];}`, 'type_1.t.array(type_1.t.boolean)'],
    [`import {t} from '@deepkit/type'; class Entity { @t p: ('a' | 'b')[];}`, `type_1.t.array(type_1.t.union('a', 'b'))`],
    [`import {t} from '@deepkit/type'; class Entity { @t p?: ('a' | 'b')[];}`, `type_1.t.array(type_1.t.union('a', 'b')).optional`],
    [`import {t} from '@deepkit/type'; class Entity { @t p: {[name: string]: number};}`, `type_1.t.record(type_1.t.string, type_1.t.number)`],
    [`import {t} from '@deepkit/type'; class Entity { @t p: {[name: string]: number|undefined};}`, `type_1.t.record(type_1.t.string, type_1.t.number.optional)`],
    [`import {t} from '@deepkit/type'; class Entity { @t p: Record<string, number>;}`, `type_1.t.record(type_1.t.string, type_1.t.number)`],
    [`import {t} from '@deepkit/type'; class Entity { @t p: Record<string, number|undefined>;}`, `type_1.t.record(type_1.t.string, type_1.t.number.optional)`],
    [`import {t} from '@deepkit/type'; class Entity { @t p: Record<string, number|string>;}`, `type_1.t.record(type_1.t.string, type_1.t.union(type_1.t.number, type_1.t.string)`],
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
