/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { MongoError } from './error.js';

type AuthMechanismProperties = { [name: string]: string | boolean };

function parsePropertyValue(value: string): string | boolean {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
}

type Milliseconds = number;

export class ConnectionOptions {
    /**
     * The replica set name.
     */
    replicaSet?: string;

    /**
     * TCP connection timeout. Default 30s.
     *
     * If the tcp connect takes longer than this value, the connection is aborted.
     */
    connectTimeout: Milliseconds = 30000;

    /**
     * Connection pool timeout. Default 1 minute.
     *
     * If no connection is available in the pool, the request is placed in a queue.
     * If it takes longer than this value, the request is aborted.
     */
    connectionAcquisitionTimeout: Milliseconds = 60 * 1000;

    /**
     * TCP socket timeout. Default not set.
     *
     * If greater than 0 `Socket.setTimeout()` will be called.
     */
    socketTimeout: Milliseconds = 0;

    /**
     * The interval in milliseconds between the heartbeat checks. Default 10s.
     */
    heartbeatFrequency: Milliseconds = 10000;

    /**
     * The maximum staleness to allow in milliseconds. Default 0 (no staleness check).
     *
     * I define this must be minimum 90 seconds:
     *    `heartbeatFrequency`+`idleWritePeriodMS` (10"000ms from the spec).
     *
     * Don't choose too low value to ensure secondaries are not considered stale too aggressively.
     */
    maxStalenessSeconds: number = 0;

    /**
     * Command response timeout. Default 0.
     *
     * If greater than 0, the command is aborted if it takes longer than this value
     * to respond. This might be tricky if you have very long-running queries.
     */
    commandTimeout: Milliseconds = 0;

    /**
     * @see https://www.mongodb.com/docs/manual/reference/write-concern/#std-label-wc-j
     */
    w?: string | number;

    /**
     * Write concern timeout in milliseconds.
     *
     * @see https://www.mongodb.com/docs/manual/reference/write-concern/#wtimeout
     */
    wtimeout?: Milliseconds;

    journal?: string;

    appName?: string;

    retryWrites: boolean = true;
    retryReads: boolean = true;

    readConcernLevel: 'local' | 'majority' | 'linearizable' | 'available' = 'majority';

    readPreference: 'primary' | 'primaryPreferred' | 'secondary' | 'secondaryPreferred' | 'nearest' = 'primary';

    readPreferenceTags?: string; //e.g. "dc:ny,rack:1"
    hedge?: boolean;

    // compressors?: 'snappy' | 'zlib' | 'zstd';
    // zlibCompressionLevel?: number;

    authSource?: string;
    authMechanism?: 'SCRAM-SHA-1' | 'SCRAM-SHA-256' | 'MONGODB-X509' | 'GSSAPI' | 'PLAIN';
    authMechanismProperties?: string;
    gssapiServiceName?: string;

    ssl?: boolean;
    tlsCertificateFile?: string;
    tlsCertificateKeyFile?: string;
    tlsCertificateKeyFilePassword?: string;
    tlsCAFile?: string;
    tlsCRLFile?: string;
    tlsAllowInvalidCertificates?: boolean;
    tlsAllowInvalidHostnames?: boolean;
    tlsInsecure?: boolean;

    /**
     * How many connections per host are allowed on the pool.
     * If this limit is reached, the connection acquisition waits until a connection is released.
     * See also `connectionAcquisitionTimeout`.
     */
    maxPoolSize: number = 20;

    minPoolSize: number = 1;

    /**
     * Close a connection after it has been idle for this duration.
     * Default 60s.
     */
    maxIdleTime: Milliseconds = 60 * 1000;

    protected parsedReadPreferenceTags?: { [name: string]: string }[];

    validate() {
        const idleWritePeriodMS = 10_000; // 10 seconds as per spec
        const maxStalenessMS = (this.maxStalenessSeconds || 0) * 1000;
        const heartbeatFrequencyMS = this.heartbeatFrequency;

        // Ensure maxStalenessSeconds meets the minimum requirements
        if (maxStalenessMS > 0 && maxStalenessMS < Math.max(90_000, heartbeatFrequencyMS + idleWritePeriodMS)) {
            throw new MongoError(`maxStalenessSeconds must be at least ${Math.max(90, (heartbeatFrequencyMS + idleWritePeriodMS) / 1000)} seconds.`);
        }
    }

    getReadPreferenceTags(): { [name: string]: string }[] {
        if (!this.parsedReadPreferenceTags) {
            this.parsedReadPreferenceTags = [];
            if (this.readPreferenceTags) {
                for (const tag of this.readPreferenceTags.split(',')) {
                    const [name, value] = tag.split(':');
                    this.parsedReadPreferenceTags.push({ [name]: value });
                }
            }
        }
        return this.parsedReadPreferenceTags;
    }

    getAuthMechanismProperties(): AuthMechanismProperties {
        const properties: AuthMechanismProperties = {};
        if (!this.authMechanismProperties) return properties;
        for (const pairs of this.authMechanismProperties.split(',')) {
            let [name, value] = pairs.trim().split(':');
            properties[name] = parsePropertyValue(value);
        }
        return properties;
    }

    get checkServerIdentity() {
        return !this.tlsAllowInvalidHostnames && !this.tlsInsecure;
    }

    get rejectUnauthorized() {
        return this.tlsInsecure || this.tlsAllowInvalidCertificates;
    }

    get secondaryReadAllowed() {
        return this.readPreference === 'secondary' || this.readPreference === 'secondaryPreferred';
    }
}
