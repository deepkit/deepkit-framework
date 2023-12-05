import { expect, test } from '@jest/globals';
import { patternMatch, ReflectionMode, reflectionModeMatcher } from '../src/resolver.js';

test('patternMatch', () => {
    expect(patternMatch('/app/model/test.ts', ['model/**/*.ts'], '/app')).toBe(true);
    expect(patternMatch('/app/model/test.ts', ['model/**/*.ts', '!**/*.ts'], '/app')).toBe(false);
    expect(patternMatch('/app/model/test.ts', ['model/**/*.ts', '!model/test.ts'], '/app')).toBe(false);
});

test('match', () => {
    const mode: ReflectionMode = [
        'model/**/*.ts',
    ];

    expect(reflectionModeMatcher('/app/model/test.ts', mode, '/app')).toBe('default');
    expect(reflectionModeMatcher('/app/model/controller/test.controller.ts', mode, '/app')).toBe('default');
    expect(reflectionModeMatcher('/app/external/file.ts', mode, '/app')).toBe('never');
});

test('match negate', () => {
    const mode: ReflectionMode = [
        'server/controllers/**/*.ts',
        'server/services/**/*.ts',
        'server/dao/**/*.ts',
        '!server/dao/mongoose.ts',
        'shared/**/*.ts',
    ];

    expect(reflectionModeMatcher('/path/portal/server/dao/models.ts', mode, '/path/portal')).toBe('default');
    expect(reflectionModeMatcher('/path/portal/server/dao/mongoose.ts', mode, '/path/portal')).toBe('never');
});
