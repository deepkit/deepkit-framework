/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { CustomError } from './core.js';

/**
 * Maps error code prefixes to their documentation page names.
 *
 * Error code format: DK-XX### where XX is the package prefix and ### is a number.
 *
 * Core packages:
 * - DK-T    @deepkit/type (runtime types, validation, serialization)
 * - DK-O    @deepkit/orm (database ORM)
 * - DK-I    @deepkit/injector (dependency injection)
 * - DK-H    @deepkit/http (HTTP server)
 * - DK-R    @deepkit/rpc (remote procedure calls)
 * - DK-B    @deepkit/bson (BSON encoding)
 * - DK-TC   @deepkit/type-compiler
 * - DK-A    @deepkit/app
 * - DK-BR   @deepkit/broker
 * - DK-F    @deepkit/framework
 *
 * Database adapters:
 * - DK-MG   @deepkit/mongo
 * - DK-PG   @deepkit/postgres
 * - DK-MY   @deepkit/mysql
 * - DK-SQ   @deepkit/sqlite
 */
const packageFromPrefix: Record<string, string> = {
    'DK-T': 'type',
    'DK-O': 'orm',
    'DK-I': 'injector',
    'DK-H': 'http',
    'DK-R': 'rpc',
    'DK-B': 'bson',
    'DK-TC': 'type-compiler',
    'DK-TS': 'topsort',
    'DK-A': 'app',
    'DK-BR': 'broker',
    'DK-F': 'framework',
    'DK-FS': 'filesystem',
    'DK-MG': 'mongo',
    'DK-PG': 'postgres',
    'DK-MY': 'mysql',
    'DK-SQ': 'sqlite',
    'DK-SQL': 'sql',
    'DK-SW': 'stopwatch',
    'DK-TPL': 'template',
    'DK-RT': 'rpc-tcp',
    'DK-ACM': 'api-console-module',
    'DK-OB': 'orm-browser',
    'DK-OBA': 'orm-browser-api',
    'DK-E': 'event',
    'DK-W': 'workflow',
};

/**
 * Extracts the package name from an error code for documentation linking.
 *
 * @example
 * getPackageFromCode('DK-T001') // returns 'type'
 * getPackageFromCode('DK-MG042') // returns 'mongo'
 */
export function getPackageFromCode(code: string): string {
    if (!code || typeof code !== 'string') return 'unknown';
    const match = code.match(/^(DK-[A-Z]+)/);
    if (match && packageFromPrefix[match[1]]) {
        return packageFromPrefix[match[1]];
    }
    return 'unknown';
}

/**
 * Generates the documentation URL for a given error code.
 */
export function getErrorDocUrl(code: string): string {
    const pkg = getPackageFromCode(code);
    return `https://deepkit.io/documentation/errors/${pkg}#${code}`;
}

/**
 * Base error class for all Deepkit errors with error codes.
 *
 * Each error has a unique code (e.g., `DK-T001`) that links to detailed
 * documentation explaining the error, common causes, and how to fix it.
 *
 * @example
 * ```typescript
 * // Direct throw with inline code
 * throw new DeepkitError('DK-T100', 'Class User has no primary key');
 *
 * // Subclass with fixed code
 * class NoPrimaryKeyError extends DeepkitError {
 *     constructor(className: string) {
 *         super('DK-T100', `Class ${className} has no primary key`);
 *     }
 * }
 * ```
 *
 * Output:
 * ```
 * DeepkitError: Class User has no primary key
 *
 * Error code: DK-T100
 * More info: https://deepkit.io/documentation/errors/type#DK-T100
 * ```
 */
export class DeepkitError extends CustomError {
    /**
     * The unique error code (e.g., 'DK-T001').
     * Can be overridden by subclasses.
     */
    public code: string;

    /**
     * URL to the documentation page for this error.
     * Computed from the current error code, so it stays correct even when
     * subclasses override the code after construction.
     */
    get docsUrl(): string {
        return getErrorDocUrl(this.code);
    }

    constructor(code: string, message: string, options?: { cause?: Error }) {
        const docsUrl = getErrorDocUrl(code);
        const fullMessage = `${message}\n\nError code: ${code}\nMore info: ${docsUrl}`;
        super(fullMessage);
        this.code = code;
        if (options?.cause) {
            this.cause = options.cause;
        }
    }

    /**
     * Returns a JSON-serializable representation of this error for structured logging.
     *
     * @example
     * ```typescript
     * try {
     *     // ... code that throws
     * } catch (error) {
     *     if (error instanceof DeepkitError) {
     *         logger.error(JSON.stringify(error.toJSON()));
     *     }
     * }
     * ```
     */
    toJSON(): { name: string; code: string; message: string; docsUrl: string; cause?: string } {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            docsUrl: this.docsUrl,
            ...(this.cause instanceof Error ? { cause: this.cause.message } : {}),
        };
    }
}
