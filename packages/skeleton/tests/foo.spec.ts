import { test } from 'node:test';
import { expect } from '@deepkit/run/expect';
import { foo } from '../src/foo.js';

test('foo', () => {
    expect(foo()).toBe('bar');
});
