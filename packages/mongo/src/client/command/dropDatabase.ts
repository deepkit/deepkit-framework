/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { Command } from './command';
import { ClassSchema, t } from '@deepkit/type';
import { ClassType } from '@deepkit/core';

const dropDatabase = t.schema({
    dropDatabase: t.number,
    $db: t.string,
});

export class DropDatabaseCommand<T extends ClassSchema | ClassType> extends Command {
    constructor(protected dbName: any) {
        super();
    }

    async execute(config): Promise<number> {
        return await this.sendAndWait(dropDatabase, {
            dropDatabase: 1, $db: this.dbName
        });
    }

    needsWritableHost(): boolean {
        return true;
    }
}
