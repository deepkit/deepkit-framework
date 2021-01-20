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
import { Command } from './command';
import { IsMasterResponse } from './ismaster';
import { MongoClientConfig } from '../client';
import { Host, HostType } from '../host';
import { Sha1ScramAuth, Sha256ScramAuth } from './auth/scram';
import { ClassType } from '@deepkit/core';
import { MongoError } from '../error';
import { MongoAuth } from './auth/auth';
import { X509Auth } from './auth/x509';

const isMasterSchema = t.schema({
    isMaster: t.number,
    $db: t.string,
    saslSupportedMechs: t.string.optional,
    client: {
        // application: {
        //     name: t.string,
        // },
        driver: {
            name: t.string,
            version: t.string,
        },
        os: {
            type: t.string,
        }
    }
});

const enum AuthMechanism {
    MONGODB_AWS = 'mongodb-aws',
    // MONGODB_CR = 'mongocr', removed in v4.0
    MONGODB_X509 = 'x509',
    MONGODB_PLAIN = 'plain', //enterprise shizzle
    MONGODB_GSSAPI = 'gssapi', //enterprise shizzle
    MONGODB_SCRAM_SHA1 = 'scram-sha-1', //default
    MONGODB_SCRAM_SHA256 = 'scram-sha-256'
}

class NotImplemented {
    constructor() {
        throw new MongoError('Auth not implemented yet');
    }
}

const authClassTypes: { [type in AuthMechanism]: ClassType } = {
    [AuthMechanism.MONGODB_SCRAM_SHA1]: Sha1ScramAuth,
    [AuthMechanism.MONGODB_SCRAM_SHA256]: Sha256ScramAuth,
    [AuthMechanism.MONGODB_X509]: X509Auth,
    [AuthMechanism.MONGODB_AWS]: NotImplemented,
    [AuthMechanism.MONGODB_GSSAPI]: NotImplemented,
    [AuthMechanism.MONGODB_PLAIN]: NotImplemented,
};

function detectedAuthMechanismFromResponse(response: IsMasterResponse): AuthMechanism {
    if (response.saslSupportedMechs && response.saslSupportedMechs.includes('SCRAM-SHA-256')) {
        return AuthMechanism.MONGODB_SCRAM_SHA256;
    }

    return AuthMechanism.MONGODB_SCRAM_SHA1;
}

/**
 * A handshake happens directly when a connection has been established.
 * It differs to regular IsMasterCommand in a way that it sends `client` data as well,
 * which is only allowed at the first message, and additionally sends auth data if necessary.
 */
export class HandshakeCommand extends Command {
    needsWritableHost() {
        return false;
    }

    async execute(config: MongoClientConfig, host: Host): Promise<boolean> {
        const db = config.getAuthSource();
        const cmd = {
            isMaster: 1,
            $db: db,
            saslSupportedMechs: !config.options.authMechanism && config.authUser ? `${db}.${config.authUser}` : undefined,
            client: {
                // application: {
                //     name: 'undefined'
                // },
                driver: {
                    name: 'deepkit/mongo',
                    version: '1.0.0'
                },
                os: {
                    type: 'Darwin'
                }
            }
        };

        const response = await this.sendAndWait(isMasterSchema, cmd, IsMasterResponse);
        const hostType = host.getTypeFromIsMasterResult(response);

        host.setType(hostType);
        if (hostType === HostType.arbiter) {
            //If the server is of type RSArbiter, no authentication is possible and the handshake is complete.
            return true;
        }

        if (config.authUser) {
            await this.doAuth(config, response);
        }

        return true;
    }

    protected async doAuth(config: MongoClientConfig, response: IsMasterResponse) {
        const authType = config.options.authMechanism || detectedAuthMechanismFromResponse(response);
        const authClassType = authClassTypes[authType];
        const auth = new authClassType as MongoAuth;

        await auth.auth(this, config);
    }
}
