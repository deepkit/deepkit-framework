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
import { t } from '@deepkit/type';
import { BaseResponse, Command } from './command';
import { MongoClientConfig } from '../client';
import { Host } from '../host';

export class IsMasterResponse extends t.extendClass(BaseResponse, {
    ismaster: t.boolean,
    maxBsonObjectSize: t.number,
    maxMessageSizeBytes: t.number,
    maxWriteBatchSize: t.number,
    minWireVersion: t.number,
    maxWireVersion: t.number,

    //indicates that the mongod or mongos is running in read-only mode
    readOnly: t.boolean,

    compression: t.array(t.string),
    saslSupportedMechs: t.array(t.string),

    //mongos instances add the following field to the isMaster response document:
    msg: t.string,

    //isMaster contains these fields when returned by a member of a replica set:
    // hosts: t.array(t.string),
    setName: t.string, //replica set name
    // setVersion: t.number, //replica set version
    secondary: t.boolean,
    arbiterOnly: t.boolean,
    hidden: t.boolean,
}) {
}

const isMasterSchema = t.schema({
    isMaster: t.number,
    $db: t.string,
});

export class IsMasterCommand extends Command {
    needsWritableHost() {
        return false;
    }

    async execute(config: MongoClientConfig, host: Host): Promise<IsMasterResponse> {
        const cmd = {
            isMaster: 1,
            $db: config.getAuthSource(),
        };

        return this.sendAndWait(isMasterSchema, cmd, IsMasterResponse);
    }
}
