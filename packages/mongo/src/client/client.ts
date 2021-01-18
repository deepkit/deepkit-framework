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

import { ConnectionRequest, MongoConnection, MongoConnectionPool } from './connection';
import { parse as parseUrl } from 'url';
import { parse as parseQueryString } from 'querystring';
import { ClassSchema, getClassSchema, jsonSerializer } from '@deepkit/type';
import { resolveSrvHosts } from './dns';
import { Host } from './host';
import { isErrorRetryableRead, isErrorRetryableWrite, MongoError } from './error';
import { ConnectionOptions } from './options';
import { arrayRemoveItem, ClassType, eachPair, singleStack, sleep } from '@deepkit/core';
import { Command } from './command/command';
import { DropDatabaseCommand } from './command/drop-database';

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
    public readonly hosts: Host[] = [];
    protected hostsFetchedMS?: number;

    /**
     * In seconds.
     */
    srvCacheTimeout: number = 3600;

    defaultDb?: string;
    authUser?: string;
    authPassword?: string;

    options: ConnectionOptions = new ConnectionOptions;

    isSrv: boolean = false;
    srvDomain: string = '';

    constructor(
        connectionString: string
    ) {
        this.parseConnectionString(connectionString);
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

        this.options = jsonSerializer.for(ConnectionOptions).validatedDeserialize(parsed.query ? parseQueryString(parsed.query) : {});

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

    resolveCollectionName(schema: ClassSchema | ClassType): string {
        schema = getClassSchema(schema);
        return schema.collectionName || schema.name || 'unknown';
    }

    @singleStack()
    async getHosts(): Promise<Host[]> {
        if (this.isSrv) {
            if (this.srvDomain === 'example.com') return [];
            if (this.hostsFetchedMS) {
                const diff = (Date.now() - this.hostsFetchedMS) / 1000;
                if (diff < this.srvCacheTimeout) return this.hosts;
            }

            const hostsData = await this.resolveSrvHosts();
            const options = { ...hostsData.options ? parseQueryString(hostsData.options) : {} };
            const partialOptions = jsonSerializer.for(ConnectionOptions).validatedDeserialize(options) as {};
            for (const [k, v] of eachPair(partialOptions)) {
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

export class MongoClient {
    protected inCloseProcedure: boolean = false;

    public readonly config: MongoClientConfig;

    protected connectionPool: MongoConnectionPool;

    constructor(
        connectionString: string
    ) {
        this.config = new MongoClientConfig(connectionString);
        this.connectionPool = new MongoConnectionPool(this.config);
    }

    public resolveCollectionName(schema: ClassSchema | ClassType): string {
        return this.config.resolveCollectionName(schema);
    }

    public async connect() {
        await this.connectionPool.connect();
    }

    public close() {
        this.inCloseProcedure = true;
        this.connectionPool.close();
    }

    async dropDatabase(dbName: string): Promise<void> {
        await this.execute(new DropDatabaseCommand(dbName));
    }

    /**
     * Returns an existing or new connection, that needs to be released once done using it.
     */
    getConnection(request: ConnectionRequest = {}): Promise<MongoConnection> {
        return this.connectionPool.getConnection(request);
    }

    public async execute<T extends Command>(command: T): Promise<ReturnType<T['execute']>> {
        const maxRetries = 10;
        const request = { writable: command.needsWritableHost() };
        await this.connectionPool.ensureHostsConnected(true);

        for (let i = 1; i <= maxRetries; i++) {
            const connection = await this.connectionPool.getConnection(request);

            try {
                return await connection.execute(command);
            } catch (error) {
                if (command.needsWritableHost()) {
                    if (!isErrorRetryableWrite(error)) throw error;
                } else {
                    if (!isErrorRetryableRead(error)) throw error;
                }

                if (i == maxRetries) {
                    throw error;
                }
                await sleep(0.25);
            } finally {
                connection.release();
            }
        }

        throw new MongoError(`Could not execute command since no connection found: ${command}`);
    }
}
