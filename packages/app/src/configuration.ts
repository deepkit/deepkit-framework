/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { isAbsolute, join } from 'path';
import { existsSync, readFileSync } from 'fs';

class ConfigOptionNotFound extends Error {
}

function findFileUntilPackageRoot(fileName: string): string | undefined {
    let dir = process.cwd();
    while (true) {
        const candidate = join(dir, fileName);
        if (existsSync(candidate) && existsSync(join(dir, 'package.json'))) {
            return candidate;
        }

        const next = join(dir, '../');
        if (next === dir) return; //reached root
        dir = next;
    }
}

export class EnvConfiguration {
    protected container: { [name: string]: any } = {};

    /**
     * Reads a .env file from given path, based to basePath.
     */
    public loadEnvFile(path: string): boolean {
        const resolvedPath = isAbsolute(path) ? path : findFileUntilPackageRoot(path);

        //search up folder until package.json root reached
        if (!resolvedPath || !existsSync(resolvedPath)) return false;

        const RE_INI_KEY_VAL = /^\s*([\w.-]+)\s*=\s*(.*)?\s*$/;

        const content = readFileSync(resolvedPath);
        for (const line of content.toString('utf8').split('\n')) {
            const keyValueArr = line.match(RE_INI_KEY_VAL);
            if (!keyValueArr) continue;

            const key = keyValueArr[1];
            let value = keyValueArr[2] || '';
            const end = value.length - 1;

            const isDoubleQuoted = value[0] === '"' && value[end] === '"';
            const isSingleQuoted = value[0] === '\'' && value[end] === '\'';

            // if single or double quoted, remove quotes
            if (isSingleQuoted) {
                value = value.substring(1, end);
            } else if (isDoubleQuoted) {
                value = JSON.parse(value);
            } else {
                value = value.trim();
            }

            this.container[key] = value;
        }
        return true;
    }

    public getKeys(): string[] {
        return Object.keys(this.container);
    }

    public getAll(): { [name: string]: any } {
        return this.container;
    }

    /**
     * Returns the value for a configuration option.
     *
     * Priority is first process.env, then manually set options, then values from the loaded env file.
     */
    public get<T = any>(name: string): T {
        if (process.env[name] !== undefined) return process.env[name] as any;

        if (this.container[name] !== undefined) return this.container[name];

        throw new ConfigOptionNotFound(`Config option ${name} not found.`);
    }

    /**
     * Sets an option value. If a env file has been read, it will be overwritten.
     */
    public set(name: string, value: any) {
        this.container[name] = value;
    }
}
