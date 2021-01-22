/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { MongoAuth } from './auth';
import { BaseResponse, Command } from '../command';
import { MongoClientConfig } from '../../config';
import { t } from '@deepkit/type';

class AuthenticateCommand extends t.class({
    authenticate: t.literal(1),
    mechanism: t.string,
    $db: t.string,
    username: t.string.optional,
}) {
}

class AuthenticateResponse extends t.extendClass(BaseResponse, {}) {
}

export class X509Auth implements MongoAuth {
    async auth(command: Command, config: MongoClientConfig): Promise<void> {
        await command.sendAndWait(AuthenticateCommand, {
            authenticate: 1,
            mechanism: 'MONGODB-X509',
            $db: '$external',
            username: config.authUser
        }, AuthenticateResponse);
    }
}
