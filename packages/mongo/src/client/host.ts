/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { MongoConnection } from './connection';

export enum HostType {
    unknown,
    standalone,
    primary,
    secondary,
    mongos,
    arbiter,
    other,
    ghost,
}

export class HostStats {
    // activeConnections: number = 0;
    // freeConnections: number = 0;

    // activeCommands: number = 0;
    // totalCommands: number = 0;
}

export class Host {
    type: HostType = HostType.unknown;

    status: string = 'pending';

    protected typeSetAt?: Date;

    readonly connections: MongoConnection[] = [];

    lastScan: Date = new Date(1000, 0);

    stats: HostStats = new HostStats;

    staleness: number = 0;

    tags: { [name: string]: string } = {};

    /**
     * Average latency in ms (used for `nearest`)
     *
     * Round Trip Times of the `ismaster` command.
     */
    latency: number = 0;

    constructor(
        public readonly hostname: string,
        public readonly port: number = 27017,
    ) {
    }

    countReservedConnections(): number {
        return this.connections.filter(v => v.reserved).length;
    }

    countTotalConnections(): number {
        return this.connections.length;
    }

    countFreeConnections(): number {
        return this.connections.filter(v => !v.reserved).length;
    }

    get id() {
        return `${this.hostname}:${this.port}`;
    }

    isWritable(): boolean {
        // todo: check if dead. check if correct replica set
        return this.type === HostType.primary || this.type === HostType.standalone || this.type === HostType.mongos;
    }

    isReadable(): boolean {
        // todo: check if dead. check if correct replica set
        return this.type === HostType.primary || this.type === HostType.standalone
            || this.type === HostType.mongos || this.type === HostType.secondary;
    }

    // state for not usable hosts like arbiters or hidden secondaries
    isUsable(): boolean {
        return this.isWritable() || this.isReadable();
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
