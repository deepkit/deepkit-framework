/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { DeepkitError } from '@deepkit/core';

/**
 * Base error class for all SQL-related errors in @deepkit/sql.
 *
 * This allows catching all SQL errors with a single catch block:
 *
 * ```typescript
 * try {
 *     await database.query(User).find();
 * } catch (error) {
 *     if (error instanceof SqlError) {
 *         // Handle any SQL error
 *         console.log('SQL error code:', error.code);
 *     }
 * }
 * ```
 *
 * Error codes: DK-SQL001 through DK-SQL012
 */
export class SqlError extends DeepkitError {
    constructor(code: string, message: string, options?: { cause?: Error }) {
        super(code, message, options);
    }
}
