/*
 * Deepkit Framework
 * Copyright Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { test } from 'node:test';

import { expect } from '@deepkit/run/expect';

import { typeOf } from '../src/reflection/reflection.js';
import { PrimaryKey, primaryKeyAnnotation } from '../src/type-annotations.js';

test('primary key', () => {
    type t = number & PrimaryKey;
    const type = typeOf<t>();
    expect(primaryKeyAnnotation.isPrimaryKey(type)).toBe(true);
});
