/*
 * Deepkit Framework
 * Copyright Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { test } from '@jest/globals';

test('array stack', () => {
    type Pop<T extends unknown[]> = T extends [...infer U, unknown] ? U : never
    type Push<T extends unknown[], U> = [...T, U]
    type Shift<T extends unknown[]> = T extends [unknown, ...infer U] ? U : never
    type Unshift<T extends unknown[], U> = [U, ...T]
});

test('StringToNum', () => {
    //to make this work, we need
    //1. ...A expression support in tuple
    //2. template literals
    //3. index access for built-ins like here Array.length
    //4. probably a stack-length limit
    type StringToNum<T extends string, A extends 0[] = []> = `${A["length"]}` extends T ? A["length"] : StringToNum<T, [...A, 0]>;
});
