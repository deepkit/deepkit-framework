/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

//see https://docs.mongodb.com/manual/reference/command/isMaster/
//we add only fields we really need to increase parsing time.
import { BaseResponse, Command } from './command.js';
import { MongoClientConfig } from '../config.js';
import { Host } from '../host.js';

export interface HelloResponse extends BaseResponse {
    connectionId: number;
    isWritablePrimary: boolean;
    localTime: Date;
    logicalSessionTimeoutMinutes: number;
    maxBsonObjectSize: number;
    maxMessageSizeBytes: number;
    maxWireVersion: number;
    minWireVersion: number;
    readOnly: boolean;
}

interface HelloSchema {
    hello: number;
    $db: string;
}

export class HelloCommand extends Command<HelloResponse> {
    needsWritableHost() {
        return false;
    }

    async execute(config: MongoClientConfig, host: Host): Promise<HelloResponse> {
        const cmd = {
            hello: 1,
            $db: config.getAuthSource(),
        };

        return this.sendAndWait<HelloSchema, HelloResponse>(cmd);
    }
}
