/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { parse as parseUrl } from 'url';
import { parse as parseQueryString } from 'querystring';
import { cast } from '@deepkit/type';
import { HostType } from './client.js';

interface ConnectionInterface {
    close(): void;
}

export class Host {
    protected type: HostType = HostType.primary;

    parameters: {[name: string]: string} = {};

    protected typeSetAt?: Date;

    /**
     * Round Trip Times of the `ismaster` command, for `nearest`
     */
    protected rrt?: number;

    public readonly connections: ConnectionInterface[] = [];

    constructor(
        public readonly config: PostgresClientConfig,
        public readonly hostname: string,
        public readonly port: number = 27017,
    ) {
    }

    get id() {
        return `${this.hostname}:${this.port}`;
    }

    isWritable(): boolean {
        return this.type === HostType.primary;
    }

    isSecondary(): boolean {
        return this.type === HostType.secondary;
    }

    isReadable(): boolean {
        return this.type === HostType.primary || this.type === HostType.secondary;
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
}

export class ConnectionOptions {
    // replicaSet?: string;

    connectTimeoutMS: number = 10000;
    socketTimeoutMS: number = 36000;

    // w?: string;
    // wtimeoutMS?: number;
    // journal?: string;

    // appName?: string;

    retryWrites: boolean = false;
    retryReads: boolean = true;

    // readConcernLevel: 'local' | 'majority' | 'linearizable' | 'available' = 'majority';

    //unknown is there to prevent Typescript generating wrong options.d.ts
    readPreference: 'primary' | 'primaryPreferred' | 'secondary' | 'secondaryPreferred' | 'nearest' | 'unknown' = 'primary';

    // maxStalenessSeconds?: number;
    // readPreferenceTags?: string; //e.g. "dc:ny,rack:1"
    // hedge?: boolean;

    // compressors?: 'snappy' | 'zlib' | 'zstd';
    // zlibCompressionLevel?: number;

    authSource?: string;
    // authMechanism?: 'SCRAM-SHA-1' | 'SCRAM-SHA-256' | 'MONGODB-X509' | 'GSSAPI' | 'PLAIN';
    // authMechanismProperties?: string;
    // gssapiServiceName?: string;

    //todo check what postgres needs
    ssl?: boolean;
    tlsCertificateFile?: string;
    tlsCertificateKeyFile?: string;
    tlsCertificateKeyFilePassword?: string;
    tlsCAFile?: string;
    tlsCRLFile?: string;
    tlsAllowInvalidCertificates?: boolean;
    tlsAllowInvalidHostnames?: boolean;
    tlsInsecure?: boolean;

    // queue stuff
    maxPoolSize: number = 20;
    minPoolSize: number = 1;
    maxIdleTimeMS: number = 100;
    waitQueueTimeoutMS: number = 0;

    get rejectUnauthorized() {
        return this.tlsInsecure || this.tlsAllowInvalidCertificates;
    }

    get checkServerIdentity() {
        return !this.tlsAllowInvalidHostnames && !this.tlsInsecure;
    }

    get secondaryReadAllowed() {
        return this.readPreference === 'secondary' || this.readPreference === 'secondaryPreferred';
    }
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
export class PostgresClientConfig {
    defaultDb?: string;
    authUser?: string;
    authPassword?: string;
    public readonly hosts: Host[] = [];

    options: ConnectionOptions = new ConnectionOptions;

    constructor(connectionString: string) {
        this.parseConnectionString(connectionString);
    }

    async getHosts(): Promise<Host[]> {
        return this.hosts;
    }

    protected parseConnectionString(url: string) {
        //we replace only first `,` with `/,` so we get additional host names in parsed.path
        url = url.replace(',', '/,');

        const parsed = parseUrl(url);
        //e.g. for `database://peter:asd@localhost,127.0.0.1,yetanother/asd`
        //parsed.pathname contains now /,127.0.0.1,yetanother/asd
        //and parsed.hostname localhost. Thus we merge those, when we detect `/,` in path
        const hostnames: string[] = [];
        let defaultDb = parsed.pathname ? parsed.pathname.substr(1) : '';

        if (!parsed.hostname) throw new Error('No hostname found in connection string');
        hostnames.push(`${parsed.hostname}:${parsed.port || 5432}`);

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
            this.hosts.push(new Host(this, host, port ? parseInt(port, 10) : 27017));
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
    }

    getAuthSource(): string {
        return this.options.authSource || this.defaultDb || 'admin';
    }
}
