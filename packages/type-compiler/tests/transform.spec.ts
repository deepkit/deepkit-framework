import { test } from 'node:test';
import * as ts from 'typescript';
import { ScriptKind, ScriptTarget, createSourceFile } from 'typescript';

import { expect } from '@deepkit/run/expect';

import { ReflectionTransformer } from '../src/compiler.js';
import { transform } from './utils.js';

test('transform simple TS', () => {
    const sourceFile = createSourceFile(
        'app.ts',
        `
        import { Logger } from './logger.js';

        function fn(logger: Logger) {}
    `,
        ScriptTarget.ESNext,
        undefined,
        ScriptKind.TS,
    );

    const res = ts.transform(sourceFile, [context => node => new ReflectionTransformer(context).withReflection({ reflection: 'default' }).transformSourceFile(node)]);
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    const code = printer.printNode(ts.EmitHint.SourceFile, res.transformed[0], res.transformed[0]);

    expect(code).toContain('fn.__type');
});

test('transform simple JS', () => {
    const sourceFile = createSourceFile(
        'app.ts',
        `
        import { Logger } from './logger.js';
        const a = (v) => {
            return v + 1;
        }
        function fn(logger) {}
    `,
        ScriptTarget.ESNext,
        undefined,
        ScriptKind.JS,
    );

    const res = ts.transform(sourceFile, [context => node => new ReflectionTransformer(context).withReflection({ reflection: 'default' }).transformSourceFile(node)]);
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    const code = printer.printNode(ts.EmitHint.SourceFile, res.transformed[0], res.transformed[0]);

    expect(code).not.toContain('fn.__type');
});

test('transform util', () => {
    const res = transform({ app: `function log(message: string) {}` });
    expect(res.app).toContain('log.__type = ');
});

test('resolve import ts', () => {
    const res = transform({
        app: `
            import { Logger } from './logger.js';
            function fn(logger: Logger) {}
        `,
        logger: `export class Logger {}`,
    });

    expect(res.app).toContain('() => Logger');
    expect(res.logger).toContain('static __type');
});

test('resolve import d.ts', () => {
    const res = transform({
        app: `
            import { Logger } from './logger.js';
            function fn(logger: Logger) {}
        `,
        'logger.d.ts': `export declare class Logger {}`,
    });

    expect(res.app).toContain('() => Logger');
});

test('resolve import node_modules', () => {
    const res = transform({
        app: `
            import { Logger } from 'logger';
            function fn(logger: Logger) {}
        `,
        'node_modules/logger/index.d.ts': `export declare class Logger {}`,
    });

    expect(res.app).toContain('() => Logger');
});

test('pass type argument named function', () => {
    const res = transform({
        app: `
            function getType<T>(type?: ReceiveType<T>) {
            }

            getType<string>();
        `,
    });

    // Direct passing: type arg is passed as a function argument, no Ω at call site
    expect(res.app).toContain(`getType<string>([`);
    expect(res.app).not.toContain(`getType.Ω = [`);
});

test('pass type argument arrow function', () => {
    const res = transform({
        app: `
            (<T>(type?: ReceiveType<T>) => {})<string>();
        `,
    });

    // compiles, but type does not receive anything
    console.log(res);
});

test('globals', () => {
    const res = transform({
        app: `
            interface User {}
            export type a = Partial<User>;
        `,
    });

    //we just make sure the global was detected and embedded
    expect(res.app).toContain('const __ΩPartial = ');
    expect(res.app).toContain('() => __ΩPartial');
});

test('class expression', () => {
    const res = transform({
        app: `
            const a = class {};
        `,
    });

    expect(res.app).toContain('static __type = [');
});

test('export default function', () => {
    const res = transform({
        app: `
            export default function(bar: string) {
                return bar;
            }
        `,
    });

    expect(res.app).toContain('export default __assignType(function (bar: string');
});

test('export default async function', () => {
    const res = transform({
        app: `
            export default async function(bar: string) {
                return bar;
            }
        `,
    });

    expect(res.app).toContain('export default __assignType(async function (bar: string');
});

test('default function name', () => {
    const res = transform({
        app: `
            const a = {
                default(val: any): any {
                    console.log('default',val)
                    return 'default'
                }
            };
        `,
    });

    //`function default(` is invalid syntax.
    //as solution we skip that transformation.
    expect(res.app).not.toContain('function default(');
});

test('declaration file', () => {
    const res = transform({
        'app.ts': `
            import { T } from './types';

            typeOf<T>();
        `,
        'types.d.ts': `
            export type T = string;
            export type __ΩT = any[];
        `,
    });

    expect(res['app.ts']).toContain("import { __ΩT } from './types");
});

test('declaration file resolved export all', () => {
    const res = transform({
        'app.ts': `
            import 'import';
            import { T, T2 } from './module';
            import 'import2';
            typeOf<T>();
            typeOf<T2>();
        `,
        'module.d.ts': `
            export * from './module/types';
        `,
        'module/types.d.ts': `
            export type T = string;
            export type T2 = string;
            export type __ΩT = any[];
            export type __ΩT2 = any[];
        `,
    });

    // It's important to not put the __ΩT import before other imports
    expect(res['app.ts']).toContain(`import 'import';
/*@ts-ignore*/
import { __ΩT, __ΩT2 } from './module';
import { T, T2 } from './module';
import 'import2';`);
});

test('import typeOnly interface', () => {
    const res = transform({
        'app.ts': `
            import type { Cache } from './module';
            return typeOf<Cache>();
        `,
        'module.d.ts': `
            export interface Cache {
            }
        `,
    });

    //make sure OP.typeName with its type name is emitted
    expect(res['app.ts']).toContain(`['Cache',`);
});

test('import typeOnly class', () => {
    const res = transform({
        'app.ts': `
            import type { Cache } from './module';
            typeOf<Cache>();
        `,
        'module.d.ts': `
            export declare class Cache {
            }
        `,
    });

    //make sure OP.typeName with its type name is emitted
    expect(res['app.ts']).toContain(`['Cache',`);
});

test('reexport existing', () => {
    const res = transform({
        'app.ts': `
            import { Cache } from './module';
            typeOf<Cache>();
        `,
        'module.ts': `
            import { Cache } from './class';

            export { Cache }
        `,
        'class.ts': `
            export class Cache {}
        `,
    });

    //make sure OP.typeName with its type name is emitted
    expect(res['app.ts']).toContain(`() => Cache`);
});

test('named re-export with __Ω symbol from .ts file', () => {
    const res = transform({
        'app.ts': `
            import { User } from './index';
            typeOf<User>();
        `,
        'index.ts': `
            export { User } from './types';
        `,
        'types.ts': `
            export interface User {
                name: string;
            }
        `,
    });

    // The index.ts should re-export the __ΩUser symbol
    expect(res['index.ts']).toContain('export { __ΩUser }');
    expect(res['index.ts']).toContain("from './types'");
});

test('named re-export with __Ω symbol from .d.ts file', () => {
    const res = transform({
        'app.ts': `
            import { User } from './index';
            typeOf<User>();
        `,
        'index.ts': `
            export { User } from './types';
        `,
        'types.d.ts': `
            export interface User {
                name: string;
            }
            export type __ΩUser = any[];
        `,
    });

    // The index.ts should re-export the __ΩUser symbol
    expect(res['index.ts']).toContain('export { __ΩUser }');
    expect(res['index.ts']).toContain("from './types'");
});

test('named re-export with alias', () => {
    const res = transform({
        'app.ts': `
            import { MyUser } from './index';
            typeOf<MyUser>();
        `,
        'index.ts': `
            export { User as MyUser } from './types';
        `,
        'types.ts': `
            export interface User {
                name: string;
            }
        `,
    });

    // The index.ts should re-export __ΩUser as __ΩMyUser
    expect(res['index.ts']).toContain('export { __ΩUser as __ΩMyUser }');
    expect(res['index.ts']).toContain("from './types'");
});

test('named re-export multiple symbols', () => {
    const res = transform({
        'app.ts': `
            import { User, Post } from './index';
            typeOf<User>();
            typeOf<Post>();
        `,
        'index.ts': `
            export { User, Post } from './types';
        `,
        'types.ts': `
            export interface User {
                name: string;
            }
            export interface Post {
                title: string;
            }
        `,
    });

    // The index.ts should re-export both __ΩUser and __ΩPost
    expect(res['index.ts']).toContain('__ΩUser');
    expect(res['index.ts']).toContain('__ΩPost');
});

test('named re-export without __Ω symbol (no-op)', () => {
    const res = transform({
        'app.ts': `
            import { config } from './index';
        `,
        'index.ts': `
            export { config } from './config';
        `,
        'config.ts': `
            export const config = { debug: true };
        `,
    });

    // No __Ω re-export should be added since config is not a type
    expect(res['index.ts']).not.toContain('__Ω');
});
