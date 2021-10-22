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
import { reflect, reflect as reflect2, ReflectionClass, typeOf as typeOf2 } from '../../src/reflection/reflection';
import { assertType, ReflectionKind, ReflectionVisibility, Type, TypeClass, TypeFunction, TypeObjectLiteral, TypeProperty, TypeUnion } from '../../src/reflection/type';
import { ClassType } from '@deepkit/core';

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
    return `'${(pack(...args) as string).replace(/'/g, '\\\'')}'`;
}

const tests: [code: string | { [file: string]: string }, contains: string | string[]][] = [
    [`class Entity { p: string }`, `Entity.__type = ['p', ${packString([ReflectionOp.string, ReflectionOp.property, 0, ReflectionOp.class])}]`],
    [`class Entity { p: number }`, `Entity.__type = ['p', ${packString([ReflectionOp.number, ReflectionOp.property, 0, ReflectionOp.class])}]`],
    [`class Entity { p: boolean }`, `Entity.__type = ['p', ${packString([ReflectionOp.boolean, ReflectionOp.property, 0, ReflectionOp.class])}]`],
    [`class Entity { p: bigint }`, `Entity.__type = ['p', ${packString([ReflectionOp.bigint, ReflectionOp.property, 0, ReflectionOp.class])}]`],
    [`class Entity { p: any }`, `Entity.__type = ['p', ${packString([ReflectionOp.any, ReflectionOp.property, 0, ReflectionOp.class])}]`],
    [`class Entity { p: Date }`, `Entity.__type = ['p', ${packString([ReflectionOp.date, ReflectionOp.property, 0, ReflectionOp.class])}]`],
    [`class Entity { private p: string }`, `Entity.__type = ['p', ${packString([ReflectionOp.string, ReflectionOp.property, 0, ReflectionOp.private, ReflectionOp.class])}]`],
    [`class Entity { p?: string }`, `Entity.__type = ['p', ${packString([ReflectionOp.string, ReflectionOp.property, 0, ReflectionOp.optional, ReflectionOp.class])}]`],
    [`class Entity { p: string | undefined }`, `Entity.__type = ['p', ${packString([ReflectionOp.string, ReflectionOp.undefined, ReflectionOp.union, ReflectionOp.property, 0, ReflectionOp.class])}]`],
    [`class Entity { p: string | null }`, `Entity.__type = ['p', ${packString([ReflectionOp.string, ReflectionOp.null, ReflectionOp.union, ReflectionOp.property, 0, ReflectionOp.class])}]`],
    [`class Entity { p: number[] }`, `Entity.__type = ['p', ${packString([ReflectionOp.number, ReflectionOp.array, ReflectionOp.property, 0, ReflectionOp.class])}]`],
    [`class Entity { p: (number | string)[] }`, `Entity.__type = ['p', ${packString([ReflectionOp.number, ReflectionOp.string, ReflectionOp.union, ReflectionOp.array, ReflectionOp.property, 0, ReflectionOp.class])}]`],

    [`class Entity { p: Promise<number> }`, `Entity.__type = ['p', ${packString([ReflectionOp.number, ReflectionOp.promise, ReflectionOp.property, 0, ReflectionOp.class])}]`],
    [`class Entity { p: number | string }`, `Entity.__type = ['p', ${packString([ReflectionOp.number, ReflectionOp.string, ReflectionOp.union, ReflectionOp.property, 0, ReflectionOp.class])}]`],
    [
        `class Book {}; class IdentifiedReference<T> {} class Entity { p: IdentifiedReference<Book> }`,
        `Entity.__type = [() => Book, () => IdentifiedReference, 'p', ${packString([ReflectionOp.classReference, 0, ReflectionOp.classReference, 1, ReflectionOp.property, 2, ReflectionOp.class])}]`
    ],
    [
        `class Container<T> {data: T}`,
        `Container.__type = ['T', 'data', ${packString([ReflectionOp.template, 0, ReflectionOp.loads, 0, 0, ReflectionOp.property, 1, ReflectionOp.class])}]`
    ],

    [
        `class Container<T> {data: T extends boolean ? number : never}`,
        `Container.__type = ['T', 'data', ${packString([ReflectionOp.template, 0, ReflectionOp.loads, 0, 0, ReflectionOp.boolean, ReflectionOp.extends, ReflectionOp.number, ReflectionOp.never, ReflectionOp.condition, ReflectionOp.property, 1, ReflectionOp.class])}]`
    ],

    [
        `class Container<T, L> {data: T, label: L}`,
        `Container.__type = ['T', 'L', 'data', 'label', ${packString([ReflectionOp.template, 0, ReflectionOp.template, 1, ReflectionOp.loads, 0, 0, ReflectionOp.property, 2, ReflectionOp.loads, 0, 1, ReflectionOp.property, 3, ReflectionOp.class])}]`
    ],

    [`class Entity { p: string | number; p2: string}`,
        [`['p', 'p2', ${packString([ReflectionOp.string, ReflectionOp.number, ReflectionOp.union, ReflectionOp.property, 0, ReflectionOp.string, ReflectionOp.property, 1, ReflectionOp.class])}`]],

    [`class Entity { p: Uint8Array }`, `['p', ${packString([ReflectionOp.uint8Array, ReflectionOp.property, 0, ReflectionOp.class])}]`],
    [`class Model{}; class Entity { p: Model }`, `[() => Model, 'p', ${packString([ReflectionOp.classReference, 0, ReflectionOp.property, 1, ReflectionOp.class])}]`],

    [`class Entity { constructor(param: string) {} }`, `['constructor', ${packString([ReflectionOp.string, ReflectionOp.any, ReflectionOp.method, 0, ReflectionOp.class])}]`],
    [`class Entity { p(param: string): void }`, `['p', ${packString([ReflectionOp.string, ReflectionOp.void, ReflectionOp.method, 0, ReflectionOp.class])}]`],
    [`class Entity { p(param: string): any }`, `['p', ${packString([ReflectionOp.string, ReflectionOp.any, ReflectionOp.method, 0, ReflectionOp.class])}]`],
    [`class Entity { p(param: string, size: number): void }`, `['p', ${packString([ReflectionOp.string, ReflectionOp.number, ReflectionOp.void, ReflectionOp.method, 0, ReflectionOp.class])}]`],

    [`function f() {enum MyEnum {}; class Entity { p: MyEnum;} }`, `[() => MyEnum, 'p', ${packString([ReflectionOp.enum, 0, ReflectionOp.property, 1, ReflectionOp.class])}]`],

    [`class Model {} class Entity { p: Model;}`, `[() => Model, 'p', ${packString([ReflectionOp.classReference, 0, ReflectionOp.property, 1, ReflectionOp.class])}]`],
    [`class Entity { p: 'a';}`, `['a', 'p', ${packString([ReflectionOp.literal, 0, ReflectionOp.property, 1, ReflectionOp.class])}]`],
    [`class Entity { p: 'a' | 'b';}`, `['a', 'b', 'p', ${packString([ReflectionOp.literal, 0, ReflectionOp.literal, 1, ReflectionOp.union, ReflectionOp.property, 2, ReflectionOp.class])}]`],
    [`class Entity { p: 'a' | 'b' | undefined;}`, `['a', 'b', 'p', ${packString([ReflectionOp.literal, 0, ReflectionOp.literal, 1, ReflectionOp.undefined, ReflectionOp.union, ReflectionOp.property, 2, ReflectionOp.class])}]`],

    [`class Entity { p: 'a' | 'b' | 'c' | undefined;}`, `['a', 'b', 'c', 'p', ${packString([ReflectionOp.literal, 0, ReflectionOp.literal, 1, ReflectionOp.literal, 2, ReflectionOp.undefined, ReflectionOp.union, ReflectionOp.property, 3, ReflectionOp.class])}]`],
    [`class Entity { p: 'a' | 'b' | null;}`, `['a', 'b', 'p', ${packString([ReflectionOp.literal, 0, ReflectionOp.literal, 1, ReflectionOp.null, ReflectionOp.union, ReflectionOp.property, 2, ReflectionOp.class])}]`],
    [`class Entity { p: ('a' | 'b')[];}`, `['a', 'b', 'p', ${packString([ReflectionOp.literal, 0, ReflectionOp.literal, 1, ReflectionOp.union, ReflectionOp.array, ReflectionOp.property, 2, ReflectionOp.class])}]`],
    [`class Entity { p?: ('a' | 'b')[];}`, `['a', 'b', 'p', ${packString([ReflectionOp.literal, 0, ReflectionOp.literal, 1, ReflectionOp.union, ReflectionOp.array, ReflectionOp.property, 2, ReflectionOp.optional, ReflectionOp.class])}]`],
    [`class Entity { p: {[name: string]: number};}`, `['p', ${packString([ReflectionOp.string, ReflectionOp.number, ReflectionOp.indexSignature, ReflectionOp.objectLiteral, ReflectionOp.property, 0, ReflectionOp.class])}]`],
    [`class Entity { p: {[name: string]: number|undefined};}`, `['p', ${packString([ReflectionOp.string, ReflectionOp.frame, ReflectionOp.number, ReflectionOp.undefined, ReflectionOp.union, ReflectionOp.indexSignature, ReflectionOp.objectLiteral, ReflectionOp.property, 0, ReflectionOp.class])}]`],
    [`class Entity { p: {[name: number]: number};}`, `['p', ${packString([ReflectionOp.number, ReflectionOp.number, ReflectionOp.indexSignature, ReflectionOp.objectLiteral, ReflectionOp.property, 0, ReflectionOp.class])}]`],

    // todo: Record is just an alias to an indexSignature in a ObjectLiteral
    // [`class Entity { p: Record<string, number>; }`, `{ p: ${packString([ReflectionOp.objectLiteral, ReflectionOp.indexSignature, ReflectionOp.string, ReflectionOp.number])}`],
    // [`class Entity { p: Record<string, number|undefined>;}`, `{ p: ${packString([ReflectionOp.objectLiteral, ReflectionOp.indexSignature, ReflectionOp.string, ReflectionOp.union, ReflectionOp.number, ReflectionOp.undefined])}`],
    // [`class Entity { p: Record<number, number>;`, `{ p: ${packString([ReflectionOp.objectLiteral, ReflectionOp.indexSignature, ReflectionOp.number, ReflectionOp.number])}`],

    [{
        app: `import {MyEnum} from './enum'; class Entity { p: MyEnum;}`,
        enum: `export enum MyEnum {}`
    }, `[() => MyEnum, 'p', ${packString([ReflectionOp.enum, 0, ReflectionOp.property, 1, ReflectionOp.class])}]`],

    [{
        app: `import {Model} from './model'; class Entity { p: Model;}`,
        model: `export class Model {}`
    }, `[() => Model, 'p', ${packString([ReflectionOp.classReference, 0, ReflectionOp.property, 1, ReflectionOp.class])}]`],

    // [`export interface MyInterface {id: number}; class Controller { public p: MyInterface[] = [];}`,
    //     [`! RpcExecutionSubscription`, `['id', 'p', ${packString([ReflectionOp.number, ReflectionOp.propertySignature, 0, ReflectionOp.objectLiteral, ReflectionOp.array, ReflectionOp.property, 1, ReflectionOp.class])}]`]
    // ],
    //
    // [`interface Base {title: string} interface MyInterface extends Base {id: number} class Controller { public p: MyInterface[] = [];}`,
    //     [`!MyInterface`, `!Base`, `['id', 'title', 'p', ${packString([ReflectionOp.number, ReflectionOp.propertySignature, 0, ReflectionOp.string, ReflectionOp.propertySignature, 1, ReflectionOp.objectLiteral, ReflectionOp.array, ReflectionOp.property, 2, ReflectionOp.class])}]`]
    // ],
    //
    // [`export type RpcExecutionSubscription = {id: number}; class Controller { public p: RpcExecutionSubscription[] = [];}`,
    //     [`! RpcExecutionSubscription`, `['id', 'p', ${packString([ReflectionOp.number, ReflectionOp.propertySignature, 0, ReflectionOp.objectLiteral, ReflectionOp.array, ReflectionOp.property, 1, ReflectionOp.class])}]`]
    // ],
    // [`export type MyAlias = string; class Controller { public p: MyAlias[] = [];}`,
    //     [`! MyAlias`, `['p', ${packString([ReflectionOp.string, ReflectionOp.array, ReflectionOp.property, 0, ReflectionOp.class])}]`]
    // ],

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
    }`, `['p2', ${packString([ReflectionOp.number, ReflectionOp.property, 0, ReflectionOp.class])}]`],

    // Imported interfaces/types will be erased
    [{
        app: `import {Type} from './model'; class Entity { p: Type[];}`,
        model: `export type Type = {title: string}`
    }, ['!Type', `!./model`, `!import {Type} from './model'`]],

    // [{
    //     app: `import {Message, Model} from './model'; class Entity { p: Message[]; m: Model[];}`,
    //     model: `export type Message = number; export class Model {};`
    // }, ['!Message', `import { Model } from './model'`, `['p', () => Model, 'm', ${packString([
    //     ReflectionOp.number, ReflectionOp.array, ReflectionOp.property, 0,
    //     ReflectionOp.classReference, 1, ReflectionOp.array, ReflectionOp.property, 2, ReflectionOp.class])}]`]],

    [{
        app: `import {Type} from './model'; class Entity { p: Type[];}`,
        model: `export interface Type {title: string}`
    }, ['!Type', `!./model`, `!import {Type} from './model'`]],

    // multiple exports can be resolved
    [{
        app: `import {Type, Model} from './myPackage'; class Entity { p: Type[]; p2: Model[]};`,
        myPackage: `export * from './myPackageModel';`,
        myPackageModel: `export interface Type {title: string}; export class Model {}`
    }, ['!Type', `import { Model } from './myPackage'`, `['title', 'p', () => Model, 'p2', ${packString([
        ReflectionOp.string, ReflectionOp.propertySignature, 0, ReflectionOp.objectLiteral, ReflectionOp.array, ReflectionOp.property, 1,
        ReflectionOp.classReference, 2, ReflectionOp.array, ReflectionOp.property, 3, ReflectionOp.class])}]`]],

    [{
        app: `import {Type, Model} from './myPackage'; class Entity { p: Type[]; p2: Model[]};`,
        myPackage: `export {Model, Type} from './myPackageModel';`,
        myPackageModel: `export interface Type {title: string}; export class Model {}`
    }, ['!Type', `import { Model } from './myPackage'`, `['title', 'p', () => Model, 'p2', ${packString([
        ReflectionOp.string, ReflectionOp.propertySignature, 0, ReflectionOp.objectLiteral, ReflectionOp.array, ReflectionOp.property, 1,
        ReflectionOp.classReference, 2, ReflectionOp.array, ReflectionOp.property, 3, ReflectionOp.class])}]`]],

    [{
        app: `import {Type, Model} from './myPackage'; class Entity { p: Type[]; p2: Model[]};`,
        myPackage: `export {MM as Model, TT as Type} from './myPackageModel';`,
        myPackageModel: `export interface TT {title: string}; export class MM {}`
    }, ['!Type', `import { Model } from './myPackage'`, `['title', 'p', () => Model, 'p2', ${packString([
        ReflectionOp.string, ReflectionOp.propertySignature, 0, ReflectionOp.objectLiteral, ReflectionOp.array, ReflectionOp.property, 1,
        ReflectionOp.classReference, 2, ReflectionOp.array, ReflectionOp.property, 3, ReflectionOp.class])}]`]],

    [`
    /** @reflection never */
    class Entity1 { p: number;}
    class Entity2 { p: string;}
    `, [`!['p', ${packString([ReflectionOp.number, ReflectionOp.property, 0, ReflectionOp.class])}]`, `['p', ${packString([ReflectionOp.string, ReflectionOp.property, 0, ReflectionOp.class])}]`]],

    [`
    class Entity1 { p: number;}
    /** @reflection never */
    class Entity2 { p: string;}
    `, [`['p', ${packString([ReflectionOp.number, ReflectionOp.property, 0, ReflectionOp.class])}]`, `!['p', ${packString([ReflectionOp.string, ReflectionOp.property, 0, ReflectionOp.class])}]`]],

    // erasable types will be kept
    [{
        app: `import {Model} from './model'; class Entity { p: Model[];}`,
        model: `export class Model {}`
    }, [`[() => Model, 'p', ${packString([ReflectionOp.classReference, 0, ReflectionOp.array, ReflectionOp.property, 1, ReflectionOp.class])}]`, `import { Model } from './model';`]],

    //functions
    [`const fn = (param: string): void {}`, `const fn = Object.assign((param) => { }, { __type: ['', ${packString([ReflectionOp.string, ReflectionOp.void, ReflectionOp.function, 0])}] })`],
    [`const fn = (param: string) {}`, `const fn = Object.assign((param) => { }, { __type: ['', ${packString([ReflectionOp.string, ReflectionOp.any, ReflectionOp.function, 0])}] })`],
    [`const fn = () {}`, `!__type:`],
    [`const fn = (): any {}`, `const fn = Object.assign(() => { }, { __type: ['', ${packString([ReflectionOp.any, ReflectionOp.function, 0])}] })`],

    [`const fn = function () {}`, `!__type`],
    [`const fn = function (): any {}`, `const fn = Object.assign(function () { }, { __type: ['', ${packString([ReflectionOp.any, ReflectionOp.function, 0])}] })`],
    [`function createFn() { return function() {} }`, `!__type`],
    [`function createFn() { return function(): any {} }`, `return Object.assign(function () { }, { __type: ['', ${packString([ReflectionOp.any, ReflectionOp.function, 0])}] })`],

    [`class Entity { createFn() { return function(param: string) {} }}`, `return Object.assign(function (param) { }, { __type: ['', ${packString([ReflectionOp.string, ReflectionOp.any, ReflectionOp.function, 0])}] })`],

    [`function name(): any {}`, `function name() { }\nname.__type = ['name', ${packString([ReflectionOp.any, ReflectionOp.function, 0])}];`],
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

function transpileAndReturn(source: string): { [name: string]: any } {
    const js = transpile(`(() => { ${source} })()`);
    const typeOf = typeOf2;
    const reflect = reflect2;
    return eval(js);
}

test('class', () => {
    const code = `
    function say(text: string): void {}
    return class User {id: number; username: string}`;
    const clazz = transpileAndReturn(code);
    const js = transpile(code);
    console.log('js', js);
    const type = reflect(clazz);
    assertType(type, ReflectionKind.class);
    expect(type.classType).toBe(clazz);
    assertType(type.types[0], ReflectionKind.property);
    assertType(type.types[0].type, ReflectionKind.number);
    expect(type.types[0].name).toBe('id');
    assertType(type.types[1], ReflectionKind.property);
    assertType(type.types[1].type, ReflectionKind.string);
    expect(type.types[1].name).toBe('username');
});

test('generic class', () => {
    const code = `return class Container<T> {data: T}`;
    const js = transpile(code);
    const clazz = transpileAndReturn(code);
    const type = reflect(clazz, { kind: ReflectionKind.string });
    expect(type).toMatchObject({
        kind: ReflectionKind.class,
        classType: clazz,
        types: [{
            kind: ReflectionKind.property,
            name: 'data',
            visibility: ReflectionVisibility.public,
            type: { kind: ReflectionKind.string }
        }]
    });
});

test('class constructor', () => {
    const code = `return class Container {constructor(public title: string) {}}`;
    const js = transpile(code);
    console.log('js', js);
    const clazz = transpileAndReturn(code);
    const type = reflect(clazz);
    expect(type).toEqual({
        kind: ReflectionKind.class,
        classType: clazz as ClassType,
        types: [{
            kind: ReflectionKind.method,
            name: 'constructor',
            visibility: ReflectionVisibility.public,
            parameters: [
                { kind: ReflectionKind.parameter, name: 'title', type: { kind: ReflectionKind.string }, visibility: ReflectionVisibility.public }
            ],
            return: { kind: ReflectionKind.any }
        },
            { kind: ReflectionKind.property, name: 'title', type: { kind: ReflectionKind.string }, visibility: ReflectionVisibility.public }
        ]
    } as Type);
});

test('default value', () => {
    const code = `return class Container {
        id: number = 0
    }`;
    const js = transpile(code);
    const clazz = transpileAndReturn(code);
    const type = reflect(clazz);
    expect(((type as TypeClass).types[0] as TypeProperty).default!()).toBe(0);

    const reflection = new ReflectionClass(type as TypeClass);
    const id = reflection.getProperty('id')!;

    expect(id.type.kind).toBe(ReflectionKind.number);
    expect(id.hasDefault()).toBe(true);
    expect(id.getDefaultValue()).toBe(0);
});

test('external object literal', () => {
    const code = `
    type o = { a: string, b: number };
    return class Container {data: o}`;
    const js = transpile(code);

    expect(js).toContain(`var __Ωo = `);

    const clazz = transpileAndReturn(code);

    expect(reflect(clazz)).toEqual({
        kind: ReflectionKind.class,
        classType: clazz,
        types: [{
            kind: ReflectionKind.property,
            name: 'data',
            visibility: ReflectionVisibility.public,
            type: {
                kind: ReflectionKind.objectLiteral,
                types: [
                    {
                        kind: ReflectionKind.propertySignature,
                        type: { kind: ReflectionKind.string },
                        name: 'a',
                    },
                    {
                        kind: ReflectionKind.propertySignature,
                        type: { kind: ReflectionKind.number },
                        name: 'b',
                    }
                ]
            } as TypeObjectLiteral
        }]
    });
});

test('partial', () => {
    const code = `
    type Partial<T> = {
        [P in keyof T]?: T[P];
    }
    type o = { a: string, b: number };
    return class Container {data: Partial<o>}`;

    const js = transpile(code);
    console.log('js', js);
    const clazz = transpileAndReturn(code);

    expect(reflect(clazz)).toEqual({
        kind: ReflectionKind.class,
        classType: clazz,
        types: [{
            kind: ReflectionKind.property,
            name: 'data',
            visibility: ReflectionVisibility.public,
            type: {
                kind: ReflectionKind.objectLiteral,
                types: [
                    {
                        kind: ReflectionKind.propertySignature,
                        type: { kind: ReflectionKind.string },
                        name: 'a',
                        optional: true,
                    },
                    {
                        kind: ReflectionKind.propertySignature,
                        type: { kind: ReflectionKind.number },
                        name: 'b',
                        optional: true,
                    }
                ]
            } as TypeObjectLiteral
        }]
    });
});

test('function type', () => {
    const type = transpileAndReturn(`
    type fn = (a: string) => void;
    return typeOf<fn>();`);

    expect(type).toEqual({
        kind: ReflectionKind.function,
        parameters: [
            { kind: ReflectionKind.parameter, name: 'a', type: { kind: ReflectionKind.string } }
        ],
        return: { kind: ReflectionKind.void },
        name: undefined
    } as TypeFunction);
});

test('boolean type', () => {
    const type = transpileAndReturn(`
    return typeOf<boolean>();`);

    expect(type).toEqual({ kind: ReflectionKind.boolean });
});

test('resolve query string', () => {
    const type = transpileAndReturn(`
    type o = { a: string };
    return typeOf<o['a']>();`);

    expect(type).toEqual({
        kind: ReflectionKind.string
    });
});

test('resolve query union', () => {
    const type = transpileAndReturn(`
    type o = { a: string | true };
    return typeOf<o['a']>();`);

    expect(type).toEqual({
        kind: ReflectionKind.union,
        types: [
            { kind: ReflectionKind.string },
            { kind: ReflectionKind.literal, literal: true },
        ]
    });
});

test('resolve partial', () => {
    const type = transpileAndReturn(`
    type Partial2<T> = {
        [P in keyof T]?: T[P];
    }
    type o = { a: true | string };
    return typeOf<Partial2<o>>();`);

    expect(type).toEqual({
        kind: ReflectionKind.objectLiteral,
        types: [
            {
                kind: ReflectionKind.propertySignature,
                optional: true,
                name: 'a',
                type: {
                    kind: ReflectionKind.union, types: [
                        { kind: ReflectionKind.literal, literal: true },
                        { kind: ReflectionKind.string },
                    ]
                } as TypeUnion
            },
        ]
    });
});

test('resolve partial 2', () => {
    const code = `
    type Partial2<T> = {
        [P in keyof T]?: T[P];
    }

    type o = { a: string };
    type p = Partial2<o>;

    return typeOf<p>();`;

    const js = transpile(code);
    console.log('js', js);
    const type = transpileAndReturn(code);

    expect(type).toEqual({
        kind: ReflectionKind.objectLiteral,
        types: [
            {
                kind: ReflectionKind.propertySignature,
                optional: true,
                name: 'a',
                type: { kind: ReflectionKind.string }
            },
        ]
    });
});

test('conditional simple', () => {
    const code = `
    type Conditional = string extends string ? true : false;

    return typeOf<Conditional>();`;

    const js = transpile(code);
    console.log('js', js);
    const type = transpileAndReturn(code);

    expect(type).toEqual({
        kind: ReflectionKind.literal,
        literal: true,
    });
});

test('conditional map', () => {
    const code = `
    type IsString<T> = {
        [P in keyof T]: T[P] extends string ? true : false;
    }

    type o = { a: string, b: number };
    type p = IsString<o>;
    return typeOf<p>()`;

    const js = transpile(code);
    console.log('js', js);
    const type = transpileAndReturn(code);

    expect(type).toEqual({
        kind: ReflectionKind.objectLiteral,
        types: [
            { kind: ReflectionKind.propertySignature, name: 'a', type: { kind: ReflectionKind.literal, literal: true, } },
            { kind: ReflectionKind.propertySignature, name: 'b', type: { kind: ReflectionKind.literal, literal: false, } },
        ]
    });
});

test('conditional infer', () => {
    const code = `
    type Conditional = {t: string} extends {t: infer K} ? K : never;

    return typeOf<Conditional>();`;

    const js = transpile(code);
    console.log('js', js);
    const type = transpileAndReturn(code);

    expect(type).toEqual({
        kind: ReflectionKind.string
    });
});

test('nested object literal', () => {
    const code = `
    type o = { a: {t: string}, b: {t: number} };
    return typeOf<o>();`;

    const js = transpile(code);
    console.log('js', js);
    const type = transpileAndReturn(code);

    expect(type).toEqual({
        kind: ReflectionKind.objectLiteral,
        types: [
            {
                kind: ReflectionKind.propertySignature, name: 'a', type: {
                    kind: ReflectionKind.objectLiteral, types: [
                        { kind: ReflectionKind.propertySignature, name: 't', type: { kind: ReflectionKind.string } }
                    ]
                }
            },
            {
                kind: ReflectionKind.propertySignature, name: 'b', type: {
                    kind: ReflectionKind.objectLiteral, types: [
                        { kind: ReflectionKind.propertySignature, name: 't', type: { kind: ReflectionKind.number } }
                    ]
                }
            },
        ]
    });
});

test('branded type', () => {
    const code = `
    type ASD<T> = T & {__primaryKey?: true};
    return typeOf<ASD<string>>();`;

    const js = transpile(code);
    console.log('js', js);
    const type = transpileAndReturn(code);
    expect(type).toEqual({
        kind: ReflectionKind.intersection,
        types: [
            { kind: ReflectionKind.string },
            {
                kind: ReflectionKind.objectLiteral, types: [
                    { kind: ReflectionKind.propertySignature, type: { kind: ReflectionKind.literal, literal: true }, optional: true, name: '__primaryKey' }
                ]
            },
        ]
    } as Type);
    console.log('type', type);
});

test('ReceiveType', () => {
    const code = `
    function cast<T>(type: ReceiveType<T>) {
        return reflect(type);
    }
    return cast<string>();`;

    const js = transpile(code);
    console.log('js', js);
    const type = transpileAndReturn(code);
    expect(type).toEqual({ kind: ReflectionKind.string });
});

test('generic static', () => {
    const code = `
    interface Request<T> {
        body: T;
    }

    interface Body {
        title: string;
    }
    return typeOf<Request<Body>>();
    `;

    const js = transpile(code);
    console.log('js', js);
    const type = transpileAndReturn(code);
    expect(type).toEqual({
        kind: ReflectionKind.objectLiteral,
        types: [
            {
                kind: ReflectionKind.propertySignature, name: 'body', type: {

                    kind: ReflectionKind.objectLiteral,
                    types: [
                        { kind: ReflectionKind.propertySignature, name: 'title', type: { kind: ReflectionKind.string } },
                    ]
                }
            },
        ]
    });
});

test('generic dynamic', () => {
    const code = `
    interface Request<T> {
        body: T;
    }

    interface Body {
        title: string;
    }
    return typeOf<Request<unknown>>([typeOf<string>()]);
    `;

    const js = transpile(code);
    console.log('js', js);
    const type = transpileAndReturn(code);
    expect(type).toEqual({
        kind: ReflectionKind.objectLiteral,
        types: [
            {
                kind: ReflectionKind.propertySignature, name: 'body', type: { kind: ReflectionKind.string },
            }
        ]
    });
});

test('map conditional infer', () => {
    const code = `
    type Conditional<T> = {
        [P in keyof T]: T[P] extends {t: infer K} ? K : never;
    }
    type o = { a: {t: string}, b: {t: number} };
    return typeOf<Conditional<o>>();`;

    const js = transpile(code);
    console.log('js', js);
    const type = transpileAndReturn(code);

    expect(type).toEqual({
        kind: ReflectionKind.objectLiteral,
        types: [
            { kind: ReflectionKind.propertySignature, name: 'a', type: { kind: ReflectionKind.string, } },
            { kind: ReflectionKind.propertySignature, name: 'b', type: { kind: ReflectionKind.number, } },
        ]
    });
});

test('class with constructor', () => {
    const code = `
    class User {
        created: Date = new Date;

        constructor(public username: string) {}

        say(text: string): void {
        }
    }
    return User;
    `;

    const js = transpile(code);
    console.log('js', js);
    const classType = transpileAndReturn(code) as ClassType;

    const type = reflect(classType);

    expect(type).toEqual({
        kind: ReflectionKind.class,
        classType: classType,
        types: [
            {
                kind: ReflectionKind.property,
                name: 'created',
                default: () => new Date,
                visibility: ReflectionVisibility.public,
                type: { kind: ReflectionKind.class, classType: Date, types: [] }
            },
            {
                kind: ReflectionKind.method,
                name: 'constructor',
                visibility: ReflectionVisibility.public,
                return: { kind: ReflectionKind.any },
                parameters: [
                    {
                        kind: ReflectionKind.parameter,
                        name: 'username',
                        visibility: ReflectionVisibility.public,
                        type: { kind: ReflectionKind.string }
                    }
                ]
            },
            {
                kind: ReflectionKind.method,
                name: 'say',
                visibility: ReflectionVisibility.public,
                return: { kind: ReflectionKind.void },
                parameters: [
                    {
                        kind: ReflectionKind.parameter,
                        name: 'text',
                        type: { kind: ReflectionKind.string }
                    }
                ]
            },
            {
                kind: ReflectionKind.property,
                name: 'username',
                visibility: ReflectionVisibility.public,
                type: { kind: ReflectionKind.string }
            },
        ]
    } as TypeClass);
});

test('description', () => {
    const code = `
    interface User {
        /**
         * @see asd
         * @deprecated
         * @description Hello what up?
         * asdasd
         *
         * das
         */
        username: string;
    }
    return typeOf<User>();
    `;

    const js = transpile(code);
    console.log('js', js);
    const type = transpileAndReturn(code);

    expect(type).toEqual({
        kind: ReflectionKind.objectLiteral,
        types: [
            { kind: ReflectionKind.propertySignature, name: 'username', description: 'Hello what up?\nasdasd\n\ndas', type: { kind: ReflectionKind.string } }
        ]
    } as TypeObjectLiteral);
});

test('brand with symbol property', () => {
    const code = `
    const symbol = Symbol.for('computedType1');
    type MyBrand<T> = T & {[symbol]?: true};
    return typeOf<MyBrand<string>>();
    `;

    const js = transpile(code);
    console.log('js', js);
    const type = transpileAndReturn(code);
    expect(type).toEqual({
        kind: ReflectionKind.intersection,
        types: [
            { kind: ReflectionKind.string },
            {
                kind: ReflectionKind.objectLiteral, types: [
                    { kind: ReflectionKind.propertySignature, name: Symbol.for('computedType1'), type: { kind: ReflectionKind.literal, literal: true }, optional: true }
                ]
            },
        ]
    } as Type);
});

test('intersection with symbol property', () => {
    const code = `
    const symbol = Symbol.for('computedType1');
    type MyBrand = {[symbol]?: true};
    return typeOf<string & MyBrand>();
    `;

    const js = transpile(code);
    console.log('js', js);
    const type = transpileAndReturn(code);
    expect(type).toEqual({
        kind: ReflectionKind.intersection,
        types: [
            { kind: ReflectionKind.string },
            {
                kind: ReflectionKind.objectLiteral, types: [
                    { kind: ReflectionKind.propertySignature, name: Symbol.for('computedType1'), type: { kind: ReflectionKind.literal, literal: true }, optional: true }
                ]
            },
        ]
    } as Type);
});

test('branded type', () => {
    const code = `
    type PrimaryKey<T> = T & {__type?: 'primaryKey'};

    return typeOf<PrimaryKey<string>>();
    `;

    const js = transpile(code);
    console.log('js', js);
    const type = transpileAndReturn(code);
    expect(type).toEqual({
        kind: ReflectionKind.intersection,
        types: [
            { kind: ReflectionKind.string },
            {
                kind: ReflectionKind.objectLiteral, types: [
                    { kind: ReflectionKind.propertySignature, name: '__type', type: { kind: ReflectionKind.literal, literal: 'primaryKey' }, optional: true }
                ]
            },
        ]
    } as Type);
});

test('brand intersection', () => {
    const code = `
    type PrimaryKey = {__type?: 'primaryKey'};

    return typeOf<string & PrimaryKey>();
    `;

    const js = transpile(code);
    console.log('js', js);
    const type = transpileAndReturn(code);
    expect(type).toEqual({
        kind: ReflectionKind.intersection,
        types: [
            { kind: ReflectionKind.string },
            {
                kind: ReflectionKind.objectLiteral, types: [
                    { kind: ReflectionKind.propertySignature, name: '__type', type: { kind: ReflectionKind.literal, literal: 'primaryKey' }, optional: true }
                ]
            },
        ]
    } as Type);
});
