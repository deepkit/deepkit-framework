/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { t } from '@deepkit/type';

type AuthMechanismProperties = { [name: string]: string | boolean };

function parsePropertyValue(value: string): string | boolean {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
}

export class ConnectionOptions extends t.class({
    replicaSet: t.string.optional,
    connectTimeoutMS: t.number.default(10000),
    socketTimeoutMS: t.number.default(36000),

    w: t.string.optional,
    wtimeoutMS: t.number.optional,
    journal: t.string.optional,

    appName: t.string.optional,
    retryWrites: t.boolean.default(true),
    retryReads: t.boolean.default(true),

    readConcernLevel: t.union('local', 'majority', 'linearizable', 'available').default('majority'),

    //unknown is there to prevent Typescript generating wrong options.d.ts
    readPreference: t.union('primary', 'primaryPreferred', 'secondary', 'secondaryPreferred', 'nearest', 'unknown').default('primary'),

    maxStalenessSeconds: t.number.optional,
    readPreferenceTags: t.string.optional,

    compressors: t.union('snappy', 'zlib', 'zstd').optional,
    zlibCompressionLevel: t.number.optional,

    authSource: t.string.optional,
    authMechanism: t.union('SCRAM-SHA-1', 'SCRAM-SHA-256', 'MONGODB-X509', 'GSSAPI', 'PLAIN').optional,
    authMechanismProperties: t.string.optional,
    gssapiServiceName: t.string.optional,

    ssl: t.boolean.optional,
    tlsCertificateFile: t.string.optional,
    tlsCertificateKeyFile: t.string.optional,
    tlsCertificateKeyFilePassword: t.string.optional,
    tlsCAFile: t.string.optional,
    tlsCRLFile: t.string.optional,
    tlsAllowInvalidCertificates: t.boolean.optional,
    tlsAllowInvalidHostnames: t.boolean.optional,
    tlsInsecure: t.boolean.optional,

    maxPoolSize: t.number.default(20),
    minPoolSize: t.number.default(1),
    maxIdleTimeMS: t.number.default(100),
    waitQueueTimeoutMS: t.number.default(0),
}) {
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
