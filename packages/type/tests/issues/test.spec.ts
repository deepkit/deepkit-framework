import { test } from 'node:test';

import { expect } from '@deepkit/run/expect';

import { typeOf } from '../../src/reflection/reflection';
import { typeAnnotation } from '../../src/type-annotations.js';

test('test', () => {
    type MyAnnotation = { __meta?: never & ['myAnnotation'] };
    type Username = string & MyAnnotation;
    const type = typeOf<Username>();
    const data = typeAnnotation.getType(type, 'myAnnotation');
    expect(data).toEqual(undefined);
});
