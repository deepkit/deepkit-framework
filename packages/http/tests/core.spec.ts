import { test } from 'node:test';
import { expect } from '@deepkit/run/expect';

import { isElementStruct } from '../src/http.js';

test('isElementStruct', () => {
    expect(isElementStruct(null)).toBe(false);
    expect(isElementStruct(undefined)).toBe(false);
    expect(isElementStruct(0)).toBe(false);
    expect(isElementStruct({})).toBe(false);
    expect(isElementStruct(new Date())).toBe(false);
    expect(isElementStruct(Object.create(null))).toBe(false);
    expect(isElementStruct(true)).toBe(false);
    expect(isElementStruct([])).toBe(false);
    expect(isElementStruct(function b() {})).toBe(false);
    expect(isElementStruct({ render: {}, attributes: {} })).toBe(true);
});
