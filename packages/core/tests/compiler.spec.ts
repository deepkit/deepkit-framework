import { expect, test } from '@jest/globals';
import { CompilerContext } from '../src/compiler';

test('compiler', () => {
    const compiler = new CompilerContext();

    expect(compiler.reserveVariable('a')).toBe('a_0');
    expect(compiler.reserveVariable('a')).toBe('a_1');
    expect(compiler.reserveVariable('a')).toBe('a_2');
    expect(compiler.reserveVariable('a')).toBe('a_3');
    expect(compiler.reserveVariable('a')).toBe('a_4');
    expect(compiler.reserveVariable('a')).toBe('a_5');
    expect(compiler.reserveVariable('a')).toBe('a_6');
    expect(compiler.reserveVariable('a')).toBe('a_7');
    expect(compiler.reserveVariable('a')).toBe('a_8');
    expect(compiler.reserveVariable('a')).toBe('a_9');
    expect(compiler.reserveVariable('a')).toBe('a_10');
    expect(compiler.reserveVariable('a')).toBe('a_11');
    expect(compiler.reserveVariable('a')).toBe('a_12');
    expect(compiler.reserveVariable('a')).toBe('a_13');
});

test('compiler code', () => {
    const compiler = new CompilerContext();

    expect(compiler.build('return 123;')()).toBe(123);
    expect(compiler.build('return a;', 'a')(444)).toBe(444);
    expect(compiler.build('return a + b;', 'a', 'b')(444, 555)).toBe(444 + 555);

    const a = compiler.reserveVariable('a', 1337);
    expect(compiler.context.get(a)).toBe(1337);
    expect(compiler.build(`return ${a}`)()).toBe(1337);
});
