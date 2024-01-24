/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

type AuthMechanismProperties = { [name: string]: string | boolean };

function parsePropertyValue(value: string): string | boolean {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
}

export class ConnectionOptions {
    replicaSet?: string;
    connectTimeoutMS: number = 10000;
    socketTimeoutMS: number = 36000;

    w?: string;
    wtimeoutMS?: number;
    journal?: string;

    appName?: string;
    retryWrites: boolean = true;
    retryReads: boolean = true;

    readConcernLevel: 'local' | 'majority' | 'linearizable' | 'available' = 'majority';

    //unknown is there to prevent Typescript generating wrong options.d.ts
    readPreference: 'primary' | 'primaryPreferred' | 'secondary' | 'secondaryPreferred' | 'nearest' | 'unknown' =
        'primary';

    maxStalenessSeconds?: number;
    readPreferenceTags?: string;

    compressors?: 'snappy' | 'zlib' | 'zstd';
    zlibCompressionLevel?: number;

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

    maxPoolSize: number = 20;
    minPoolSize: number = 1;
    maxIdleTimeMS: number = 100;
    waitQueueTimeoutMS: number = 0;

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
