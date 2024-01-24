import { expect, test } from '@jest/globals';

import { foo } from '../src/foo.js';

test('foo', () => {
    expect(foo()).toBe('bar');
});
