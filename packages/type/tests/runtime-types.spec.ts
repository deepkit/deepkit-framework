import { test } from 'node:test';

import { expect } from '@deepkit/run/expect';

import { ReflectionProperty } from '../src/reflection/reflection.js';

test('ReflectionClass has no runtime types', () => {
    expect((ReflectionProperty as any).__type).toBe(undefined);
});

/**
 * @reflection never
 */
class Disabled {
    type: string = '';
}

test('Disabled has no runtime types', () => {
    expect((Disabled as any).__type).toBe(undefined);
});
