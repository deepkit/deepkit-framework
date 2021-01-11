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

import { MongoConnection } from './connection';

export const enum HostType {
    unknown,
    standalone,
    primary,
    secondary,
    mongos,
    arbiter,
    other,
    ghost,
}

export class Host {
    protected type: HostType = HostType.unknown;

    protected typeSetAt?: Date;

    /**
     * Round Trip Times of the `ismaster` command, for `nearest`
     */
    protected rrt?: number;

    public readonly connections: MongoConnection[] = [];

    constructor(
        public readonly hostname: string,
        public readonly port: number = 27017,
    ) {
    }

    get id() {
        return `${this.hostname}:${this.port}`;
    }

    isWritable(): boolean {
        return this.type === HostType.primary || this.type === HostType.standalone || this.type === HostType.mongos;
    }

    isSecondary(): boolean {
        return this.type === HostType.secondary;
    }

    isReadable(): boolean {
        return this.type === HostType.primary || this.type === HostType.standalone
            || this.type === HostType.mongos || this.type === HostType.secondary;
    }

    setType(type: HostType) {
        if (this.type !== type) {
            //type changed. Should we do anything special?
        }
        this.type = type;
        this.typeSetAt = new Date;
    }

    getType() {
        return this.type;
    }

    getTypeFromIsMasterResult(isMasterCmdResult: any): HostType {
        if (!isMasterCmdResult || !isMasterCmdResult.ok) return HostType.unknown;
        if (isMasterCmdResult.isreplicaset) return HostType.ghost;
        if (isMasterCmdResult.ismaster && isMasterCmdResult.msg === 'isdbgrid') return HostType.mongos;
        if (isMasterCmdResult.setName) {
            if (isMasterCmdResult.hidden) return HostType.other;
            if (isMasterCmdResult.ismaster) return HostType.primary;
            if (isMasterCmdResult.secondary) return HostType.secondary;
            if (isMasterCmdResult.arbiterOnly) return HostType.arbiter;
            return HostType.other;
        }

        return HostType.standalone;
    }
}
