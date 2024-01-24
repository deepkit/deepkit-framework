/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { ReflectionClass } from '@deepkit/type';

import { Command } from './command.js';

interface DropDatabase {
    dropDatabase: 1;
    $db: string;
}

export class DropDatabaseCommand<T extends ReflectionClass<any>> extends Command {
    constructor(protected dbName: any) {
        super();
    }

    async execute(config): Promise<void> {
        await this.sendAndWait<DropDatabase>({
            dropDatabase: 1,
            $db: this.dbName,
        });
    }

    needsWritableHost(): boolean {
        return true;
    }
}
