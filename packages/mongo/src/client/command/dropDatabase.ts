/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { Command, WriteConcernMessage } from './command.js';
import { CommandOptions } from '../options.js';

type DropDatabase = {
    dropDatabase: 1;
    $db: string;
} & WriteConcernMessage;

export class DropDatabaseCommand<T> extends Command<void> {
    commandOptions: CommandOptions = {};

    constructor(protected dbName: any) {
        super();
    }

    async execute(config): Promise<void> {
        const cmd: DropDatabase = {
            dropDatabase: 1, $db: this.dbName,
        };
        config.applyWriteConcern(cmd, this.commandOptions);
        await this.sendAndWait<DropDatabase>(cmd);
    }

    needsWritableHost(): boolean {
        return true;
    }
}
