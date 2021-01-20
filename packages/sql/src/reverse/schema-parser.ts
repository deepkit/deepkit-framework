/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { Column, DatabaseModel } from '../schema/table';
import { SQLConnection } from '../sql-adapter';
import { DefaultPlatform } from '../platform/default-platform';

const type3Regex = /^([^(]+)\(\s*(\d+)\s*,\s*(\d+)\s*\)$/;
const type2Regex = /^([^(]+)\(\s*(\d+)\s*\)$/;

export function parseType(column: Column, type: string) {
    type = type.trim().toLowerCase();

    if (type3Regex.exec(type)) {
        const match = type3Regex.exec(type)!;
        column.type = match[1];
        column.size = parseInt(match[2], 10);
        column.scale = parseInt(match[3], 10);
    } else if (type2Regex.exec(type)) {
        const match = type2Regex.exec(type)!;
        column.type = match[1];
        column.size = parseInt(match[2], 10);
    } else {
        if (type.includes('(')) throw new Error(`Could not detect type of sql type ${type}`);
        column.type = type;
    }
}


export abstract class SchemaParser {
    constructor(
        protected connection: SQLConnection,
        protected platform: DefaultPlatform,
    ) {
    }

    abstract parse(database: DatabaseModel, limitTableNames?: string[]): void;
}
