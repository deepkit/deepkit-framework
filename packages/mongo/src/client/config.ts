/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { Host } from './host.js';
import { CommandOptions, ConnectionOptions } from './options.js';
import { parse as parseUrl } from 'url';
import { parse as parseQueryString } from 'querystring';
import { MongoError } from './error.js';
import { arrayRemoveItem, singleStack } from '@deepkit/core';
import { resolveSrvHosts } from './dns.js';
import { cast, ReflectionClass } from '@deepkit/type';
import { ReadPreferenceMessage, TransactionalMessage, WriteConcernMessage } from './command/command.js';
import type { MongoDatabaseTransaction } from './connection.js';

export type Topology = 'single' | 'replicaSetNoPrimary' | 'replicaSetWithPrimary' | 'sharded' | 'unknown' | 'invalidated';

/**
 * @see https://github.com/mongodb/specifications/blob/master/source/max-staleness/max-staleness.md
 */
export function updateStaleness(config: MongoClientConfig) {
    const heartbeatFrequencyMS = config.options.heartbeatFrequencyMS || 10_000; // default to 10 seconds if not specified
    const maxStalenessMS = (config.options.maxStalenessSeconds || 0) * 1000;

    const primary = config.hosts.find(v => v.type === 'primary');
    const secondaries = config.hosts.filter(v => v.type === 'secondary');

    if (primary) {
        // Calculate primary staleness
        primary.staleness = 0; // Primary is always considered fresh
        primary.stale = false;
    }

    for (const secondary of secondaries) {
        if (!secondary.lastWriteDate || !secondary.lastUpdateTime) {
            // No heartbeat yet received
            continue;
        }

        if (primary && primary.lastUpdateTime && primary.lastWriteDate) {
            // Staleness calculation when primary is known
            const s_lastUpdateTime = secondary.lastUpdateTime.getTime();
            const s_lastWriteDate = secondary.lastWriteDate.getTime();
            const p_lastUpdateTime = primary.lastUpdateTime.getTime();
            const p_lastWriteDate = primary.lastWriteDate.getTime();

            const p_staleness = p_lastUpdateTime - p_lastWriteDate;
            const s_staleness = s_lastUpdateTime - s_lastWriteDate;

            secondary.staleness = s_staleness - p_staleness + heartbeatFrequencyMS;
        } else {
            // Staleness calculation when primary is unknown
            const maxLastWriteDate = Math.max(...secondaries.map(s => s.lastWriteDate?.getTime() || 0));
            const s_lastWriteDate = secondary.lastWriteDate.getTime();

            secondary.staleness = maxLastWriteDate - s_lastWriteDate + heartbeatFrequencyMS;
        }

        // Determine if the secondary is stale based on maxStalenessSeconds
        if (maxStalenessMS > 0) {
            secondary.stale = secondary.staleness > maxStalenessMS;
        }
    }
}

/**
 * When a replica member reports `hosts` in a heartbeat, we have to make sure to update our known hosts.
 *
 * This removes also duplicate hosts.
 *
 * Use-cases: The user specified IP, but the nodes are known under hostnames
 * config = mongodb://192.168.0.2,192.168.0.3
 * hostnames = [server1, server2]
 *
 * Resolving stage:
 *  1. initial user config: config.hosts=[192.168.0.2,192.168.0.3] (Host.id[])
 *  2. heartbeat(192.168.0.2), reporting me=server1, hosts=[server1, server2], rename id=192.168.0.2 to server1
 *  3. updateKnownHosts(): server2 is new. config.hosts=[server1, 192.168.0.3, server2]
 *  4. heartbeat(192.168.0.3), reporting me=server1, hosts=[server1, server2], rename id=192.168.0.3 to server2
 *  4. heartbeat(server2), reporting me=server2, hosts=[server1, server2], detected as duplicate, remove, config.hosts=[server1, server2]
 *
 * In this case we have temporarily a duplicate host `server2`, since at point 3 the heartbeat of `192.168.0.3`
 * was not finished yet. This is fine, since we remove duplicates in the end after asking `192.168.0.3` what its real hostname is.
 *
 * Use-case: The user specified hostnames, but the nodes are known under IPs
 * config = mongodb://server1,server2
 * hostname = [192.168.0.2, 192.168.0.3]
 *
 * `hostname` is what the replica member reports as `me`.
 * We use hostname as Host.id.
 */
export function updateKnownHosts(config: MongoClientConfig): Host[] {
    if (config.options.directConnection) return [];

    const newHosts: Host[] = [];
    for (const host of config.hosts.slice()) {
        // check if hosts are all known
        const referencedHosts = [...host.hosts, ...host.passives, ...host.arbiters];
        for (const reportedHost of referencedHosts) {
            if (!reportedHost) continue;
            const exists = config.hosts.find(v => v.id === reportedHost);
            if (exists) continue;

            const [hostname, port] = reportedHost.split(':');
            const newHost = new Host(hostname, port ? parseInt(port, 10) : 27017);
            newHost.id = reportedHost;
            config.hosts.push(newHost);
            newHosts.push(newHost);
        }
    }
    return newHosts;
}

export function detectTopology(hosts: Host[]): Topology {
    const hasStandalone = hosts.find(v => v.type === 'standalone');
    if (hasStandalone) return 'single';

    const hasPrimary = hosts.find(v => v.type === 'primary');
    if (hasPrimary) {
        return 'replicaSetWithPrimary';
    }

    const hasMongoS = hosts.find(v => v.type === 'mongos');
    if (hasMongoS) {
        return 'sharded';
    }

    return 'replicaSetNoPrimary';
}

/**
 * Default URL:
 * mongodb://mongodb0.example.com:27017
 *
 * ReplicaSet UR:
 * mongodb://mongodb0.example.com:27017,mongodb1.example.com:27017,mongodb2.example.com:27017/?replicaSet=myRepl
 *
 * Shared URL:
 * mongodb://mongos0.example.com:27017,mongos1.example.com:27017,mongos2.example.com:27017
 *
 * SVR URL:
 * mongodb+srv://server.example.com/
 */
export class MongoClientConfig {
    topology: Topology = 'unknown';

    topologyId: number = 0;

    readonly hosts: Host[] = [];

    protected hostsFetchedMS?: number;

    defaultDb?: string;
    authUser?: string;
    authPassword?: string;

    options: ConnectionOptions = new ConnectionOptions;

    isSrv: boolean = false;
    srvDomain: string = '';

    lastTopologyKey: string = '';

    constructor(
        connectionString: string,
    ) {
        this.parseConnectionString(connectionString);
    }

    /**
     * Unique representation of a topology. If this changes, the topology has changed.
     * Topology change happens when:
     *
     * - A new host is added
     * - A host is removed
     * - A host changes its type
     * - A host is marked as dead
     * - A host is marked as stale
     */
    topologyKey(): string {
        return this.hosts.map(v => `${v.hostname}:${v.port}=${v.type}:${v.stale}:${v.readonly}`).join(',');
    }

    shortSummary(): string {
        const lines: string[] = [];
        for (const host of this.hosts) {
            let id = host.id;
            if (id !== `${host.hostname}:${host.port}`) {
                id += `(${host.hostname}:${host.port})`;
            }
            const attributes: string[] = [host.type];
            if (host.dead) attributes.push('dead(' + host.status + ')');
            if (host.connections.length) attributes.push('connections=' + host.connections.length);
            attributes.push('latency=' + host.latency + 'ms');
            if (host.stale) attributes.push('stale');
            attributes.push('staleness=' + host.staleness + 'ms');

            lines.push(`${id}=${attributes.join(' ')}`);
        }
        return lines.join(', ');
    }

    invalidate() {
        if (this.topology === 'invalidated') return;
        this.topologyId++;
        this.topology = 'invalidated';
    }

    getTopology(): string {
        return this.hosts.map(v => `${v.hostname}:${v.port}=${v.status}`).join(',');
    }

    /**
     * Applies the write concern to the command.
     *
     * This must not be called in a transaction for normal commands, since only
     * commitTransaction/abortTransaction commands are allowed to set writeConcern.
     */
    applyWriteConcern(cmd: WriteConcernMessage, options: CommandOptions) {
        if (this.options.w || this.options.journal || this.options.wtimeout || options.writeConcern || options.journal || options.wtimeout) {
            cmd.writeConcern = {};
            if (this.options.w !== undefined) cmd.writeConcern.w = this.options.w;
            if (this.options.journal !== undefined) cmd.writeConcern.j = this.options.journal;
            if (this.options.wtimeout !== undefined) cmd.writeConcern.wtimeout = this.options.wtimeout;
            if (options.writeConcern !== undefined) cmd.writeConcern.w = options.writeConcern;
            if (options.journal !== undefined) cmd.writeConcern.j = options.journal;
            if (options.wtimeout !== undefined) cmd.writeConcern.wtimeout = options.wtimeout;
        }
    }

    /**
     * @see https://github.com/mongodb/specifications/blob/master/source/server-selection/server-selection.md#passing-read-preference-to-mongos-and-load-balancers
     */
    applyReadPreference(host: Host, cmd: ReadPreferenceMessage & TransactionalMessage, options: CommandOptions, transaction?: MongoDatabaseTransaction) {
        const readPreference = options.readPreference || this.options.readPreference;
        if (readPreference === 'primary') return;

        if (transaction && !cmd.startTransaction) {
            // readConcern to use for the first command, and only the first command, in a transaction
            return;
        }

        const readConcernLevel = options.readConcernLevel || this.options.readConcernLevel;
        if (readConcernLevel) {
            cmd.readConcern = { level: readConcernLevel };
        }

        const readTags = options.readPreferenceTags || this.options.readPreferenceTags;

        if (readPreference) {
            cmd.$readPreference = {
                mode: readPreference,
            };

            if (readTags) {
                cmd.$readPreference.tags = this.options.parsePreferenceTags(readTags);
            }
            if (this.options.maxStalenessSeconds) {
                cmd.$readPreference.maxStalenessSeconds = this.options.maxStalenessSeconds;
            }
            if (this.options.hedge) cmd.$readPreference.hedge = { enabled: true };
        }
    }

    protected parseConnectionString(url: string) {
        //we replace only first `,` with `/,` so we get additional host names in parsed.path
        url = url.replace(',', '/,');

        const parsed = parseUrl(url);
        //e.g. for `mongodb://peter:asd@localhost,127.0.0.1,yetanother/asd`
        //parsed.pathname contains now /,127.0.0.1,yetanother/asd
        //and parsed.hostname localhost. Thus we merge those, when we detect `/,` in path
        const hostnames: string[] = [];
        let defaultDb = parsed.pathname ? parsed.pathname.substr(1) : '';

        if (!parsed.hostname) throw new Error('No hostname found in connection string');
        hostnames.push(`${parsed.hostname}:${parsed.port || 27017}`);

        if (parsed.pathname && parsed.pathname.startsWith('/,')) {
            //we got multiple host names
            const lastSlash = parsed.pathname.lastIndexOf('/');
            if (lastSlash === 0) {
                //no database name provided, so whole path contains host names
                //offset `2` because `/,`
                hostnames.push(...parsed.pathname.substr(2).split(','));
                defaultDb = '';
            } else {
                hostnames.push(...parsed.pathname.substr(2, lastSlash).split(','));
                defaultDb = parsed.pathname.substr(lastSlash + 1);
            }
        }

        this.hosts.splice(0, this.hosts.length);
        for (const hostname of hostnames) {
            const [host, port] = hostname.split(':');
            this.hosts.push(new Host(host, port ? parseInt(port, 10) : 27017));
        }

        this.defaultDb = defaultDb;

        if (parsed.auth) {
            const firstColon = parsed.auth.indexOf(':');
            if (firstColon === -1) {
                this.authUser = parsed.auth;
            } else {
                this.authUser = parsed.auth.substr(0, firstColon);
                this.authPassword = parsed.auth.substr(firstColon + 1);
            }
        }

        const options = parsed.query ? parseQueryString(parsed.query) : {};
        this.options = cast<ConnectionOptions>(options);

        if (url.startsWith('mongodb+srv://')) {
            this.isSrv = true;
            this.srvDomain = this.hosts[0].hostname;
        }
    }

    //see https://docs.mongodb.com/manual/reference/connection-string/#urioption.authSource
    getAuthSource(): string {
        return this.options.authSource || this.defaultDb || 'admin';
    }

    protected async resolveSrvHosts() {
        return await resolveSrvHosts(this.srvDomain);
    }

    newHost(hostname: string, port: number) {
        const host = new Host(hostname, port);
        this.hosts.push(host);
    }

    protected findHostBy(hostname: string, port: number): Host {
        for (const host of this.hosts) {
            if (host.hostname === hostname && host.port === port) return host;
        }
        throw new MongoError(`Could not find host ${hostname}:${port}`);
    }

    deleteHost(hostname: string, port: number) {
        const host = this.findHostBy(hostname, port);
        arrayRemoveItem(this.hosts, host);
        for (const connection of host.connections) {
            connection.close();
        }
    }

    resolveCollectionName(schema: ReflectionClass<any>): string {
        return schema.getCollectionName() || 'unknown';
    }

    @singleStack()
    async getHosts(): Promise<Host[]> {
        if (this.isSrv) {
            if (this.srvDomain === 'example.com') return [];

            //todo: refactor this to do it in the background
            if (this.hostsFetchedMS) {
                const diff = (Date.now() - this.hostsFetchedMS) / 1000;
                if (diff < this.options.srvCacheTimeout) return this.hosts;
            }

            const hostsData = await this.resolveSrvHosts();
            const options = { ...hostsData.options ? parseQueryString(hostsData.options) : {} };
            const partialOptions = cast<ConnectionOptions>(options) as {};
            for (const [k, v] of Object.entries(partialOptions)) {
                this.options[k] = v;
            }
            const hosts = hostsData.hosts;

            const removedHosts = new Map<string, Host>();
            for (const host of this.hosts) {
                removedHosts.set(host.id, host);
            }

            for (const host of hosts) {
                const id = `${host.hostname}:${host.port}`;
                if (removedHosts.has(id)) {
                    removedHosts.delete(id);
                } else {
                    //we got a new one
                    this.newHost(host.hostname, host.port);
                }
            }

            //removedHosts contains now all no longer valid hosts
            for (const removedHost of removedHosts.values()) {
                this.deleteHost(removedHost.hostname, removedHost.port);
            }

            this.hostsFetchedMS = Date.now();

            //default to SSL true if it's not specified
            if (this.options.ssl === undefined) {
                this.options.ssl = true;
            }
        }

        return this.hosts;
    }
}
