/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

/**
 * Local error class for type-compiler.
 *
 * IMPORTANT: type-compiler cannot import from @deepkit/core because core
 * depends on type-compiler for its build. This would create a circular dependency.
 */
export class TypeCompilerError extends Error {
    public name = 'TypeCompilerError';

    constructor(
        public code: string,
        message: string,
    ) {
        super(
            `${message}\n\nError code: ${code}\nMore info: https://deepkit.io/documentation/errors/type-compiler#${code}`,
        );
    }
}
