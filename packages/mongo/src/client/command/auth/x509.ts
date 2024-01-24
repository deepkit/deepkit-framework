/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { MongoClientConfig } from '../../config.js';
import { BaseResponse, Command } from '../command.js';
import { MongoAuth } from './auth.js';

interface AuthenticateCommand {
    authenticate: 1;
    mechanism: string;
    $db: string;
    username?: string;
}

interface AuthenticateResponse extends BaseResponse {}

export class X509Auth implements MongoAuth {
    async auth(command: Command, config: MongoClientConfig): Promise<void> {
        await command.sendAndWait<AuthenticateCommand, AuthenticateResponse>({
            authenticate: 1,
            mechanism: 'MONGODB-X509',
            $db: '$external',
            username: config.authUser,
        });
    }
}
