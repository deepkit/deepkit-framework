import { test, expect } from '@jest/globals';
import { foo } from '../src/foo';

test('foo', () => {
    expect(foo()).toBe('bar');
});
