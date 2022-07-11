import * as ts from 'typescript';
import { createSourceFile, ScriptTarget } from 'typescript';
import { expect, test } from '@jest/globals';
import { ReflectionTransformer } from '../src/compiler';
import { transform } from './utils';

test('transform simple', () => {
    const sourceFile = createSourceFile('app.ts', `
        import { Logger } from './logger';

        function fn(logger: Logger) {}
    `, ScriptTarget.ESNext);

    const res = ts.transform(sourceFile, [(context) => (node) => new ReflectionTransformer(context).withReflectionMode('always').transformSourceFile(node)]);
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    const code = printer.printNode(ts.EmitHint.SourceFile, res.transformed[0], res.transformed[0]);

    console.log(code);
});

test('transform util', () => {
    const res = transform({ app: `function log(message: string) {}` });
    expect(res.app).toContain('log.__type = ');
});

test('resolve import ts', () => {
    const res = transform({
        'app': `
            import { Logger } from './logger';
            function fn(logger: Logger) {}
        `,
        'logger': `export class Logger {}`
    });

    console.log(res);
    expect(res.app).toContain('() => Logger');
    expect(res.logger).toContain('static __type');
});

test('resolve import d.ts', () => {
    const res = transform({
        'app': `
            import { Logger } from './logger';
            function fn(logger: Logger) {}
        `,
        'logger.d.ts': `export declare class Logger {}`
    });

    console.log(res);
    expect(res.app).toContain('() => Logger');
});

test('resolve import node_modules', () => {
    const res = transform({
        'app': `
            import { Logger } from 'logger';
            function fn(logger: Logger) {}
        `,
        'node_modules/logger/index.d.ts': `export declare class Logger {}`
    });

    console.log(res);
    expect(res.app).toContain('() => Logger');
});

test('pass type argument named function', () => {
    const res = transform({
        'app': `
            function getType<T>(type?: ReceiveType<T>) {
            }

            getType<string>();
        `
    });

    console.log(res);
    expect(res.app).toContain(`(getType.Ω = `);
    expect(res.app).toContain(`, getType<string>())`);
});

test('pass type argument arrow function', () => {
    const res = transform({
        'app': `
            (<T>(type?: ReceiveType<T>) => {})<string>();
        `
    });

    console.log(res);
});

test('globals', () => {
    const res = transform({
        'app': `
            interface User {}
            export type a = Partial<User>;
        `
    });

    //we just make sure the global was detected and embedded
    expect(res.app).toContain('const __ΩPartial = ');
    expect(res.app).toContain('() => __ΩPartial');
});

test('class expression', () => {
    const res = transform({
        'app': `
            const a = class {};
        `
    });

    expect(res.app).toContain('static __type = [');
});

test('export default function', () => {
    const res = transform({
        'app': `
            export default function(bar: string) {
                return bar;
            }
        `
    });

    expect(res.app).toContain('export default __assignType(function (bar: string');
});

test('export default async function', () => {
    const res = transform({
        'app': `
            export default async function(bar: string) {
                return bar;
            }
        `
    });

    expect(res.app).toContain('export default __assignType(async function (bar: string');
});
