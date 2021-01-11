/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
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
