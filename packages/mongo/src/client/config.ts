/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { parse as parseQueryString } from 'querystring';
import { parse as parseUrl } from 'url';

import { arrayRemoveItem, eachPair, singleStack } from '@deepkit/core';
import { ReflectionClass, validatedDeserialize } from '@deepkit/type';

import { resolveSrvHosts } from './dns.js';
import { MongoError } from './error.js';
import { Host } from './host.js';
import { ConnectionOptions } from './options.js';

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

    options: ConnectionOptions = new ConnectionOptions();

    isSrv: boolean = false;
    srvDomain: string = '';

    constructor(connectionString: string) {
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

        const options = parsed.query ? parseQueryString(parsed.query) : {};
        this.options = validatedDeserialize<ConnectionOptions>(options);

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
                if (diff < this.srvCacheTimeout) return this.hosts;
            }

            const hostsData = await this.resolveSrvHosts();
            const options = { ...(hostsData.options ? parseQueryString(hostsData.options) : {}) };
            const partialOptions = validatedDeserialize<ConnectionOptions>(options) as {};
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
