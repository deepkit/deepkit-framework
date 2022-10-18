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

export interface IsMasterResponse extends BaseResponse {
    ismaster: boolean;
    maxBsonObjectSize: number;
    maxMessageSizeBytes: number;
    maxWriteBatchSize: number;
    minWireVersion: number;
    maxWireVersion: number;

    //indicates that the mongod or mongos is running in read-only mode
    readOnly?: boolean;

    compression?: string[];
    saslSupportedMechs?: string[];

    //mongos instances add the following field to the isMaster response document:
    msg?: string;

    //isMaster contains these fields when returned by a member of a replica set:
    // hosts: string[];
    setName?: string; //replica set name
    // setVersion: number; //replica set version
    secondary?: boolean;
    arbiterOnly?: boolean;
    hidden?: boolean;
}

interface IsMasterSchema {
    isMaster: number;
    $db: string;
}

export class IsMasterCommand extends Command {
    needsWritableHost() {
        return false;
    }

    async execute(config: MongoClientConfig, host: Host): Promise<IsMasterResponse> {
        const cmd = {
            isMaster: 1,
            $db: config.getAuthSource(),
        };

        return this.sendAndWait<IsMasterSchema, IsMasterResponse>(cmd);
    }
}
