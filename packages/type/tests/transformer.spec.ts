import { describe, expect, test } from '@jest/globals';
import { CompilerOptions, ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import { transformer } from '../src/transformer';

Error.stackTraceLimit = 200;

function transpile(code: string): string {
    const options: CompilerOptions = {
        experimentalDecorators: true,
        module: ModuleKind.CommonJS,
        target: ScriptTarget.ES2020,
    };

    return transpileModule(code, {
        compilerOptions: options,
        transformers: { before: [transformer] }
    }).outputText;
}

const tests: [code: string, contains: string][] = [
    [`import {t} from '@deepkit/type'; class Entity { @t p: number;}`, 'type_1.t.number'],
    [`import {t} from '@deepkit/type'; class Entity { @t p?: number;}`, 'type_1.t.number.optional'],
    [`import {t} from '@deepkit/type'; class Entity { @t p: string;}`, 'type_1.t.string'],
    [`import {t} from '@deepkit/type'; class Entity { @t p: boolean;}`, 'type_1.t.boolean'],
    [`import {t} from '@deepkit/type'; class Entity { @t p: Date;}`, 'type_1.t.date'],
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
        test(`${contains}: ${code.slice(-40)}`, () => {
            expect(transpile(code)).toContain(contains);
        });
    }
});
