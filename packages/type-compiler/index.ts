/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import type { Program } from 'typescript';

import { declarationTransformer, transformer } from './src/compiler.js';

export * from './src/compiler.js';
export * from './src/loader.js';

export default function myTransformerPlugin(program: Program, opts: {}) {
    return {
        before: transformer,
        afterDeclarations: declarationTransformer,
    };
}
