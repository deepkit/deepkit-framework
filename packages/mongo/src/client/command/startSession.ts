/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { BaseResponse, Command } from './command.js';
import { MongoClientConfig } from '../config.js';
import { Host } from '../host.js';
import { UUID } from '@deepkit/type';

interface SessionResponse extends BaseResponse {
    id: { id: UUID };
}

interface SessionSchema {
    startSession: number;
    $db: string;
    lsid?: { id: UUID };
    txnNumber?: number;
    autocommit?: boolean;
}

export class StartSessionCommand extends Command {
    needsWritableHost() {
        return false;
    }

    async execute(config: MongoClientConfig, host: Host, transaction): Promise<SessionResponse> {
        const cmd = {
            startSession: 1,
            $db: 'admin',
        };

        if (transaction) transaction.applyTransaction(cmd);

        return await this.sendAndWait<SessionSchema, SessionResponse>(cmd);
    }
}
