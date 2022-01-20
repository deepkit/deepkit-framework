/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { UUID } from '@deepkit/type';
import { BaseResponse, Command } from './command';
import { MongoClientConfig } from '../config';
import { Host } from '../host';

interface Request {
    abortTransaction: number,
    $db: string,
    lsid?: { id: UUID },
    txnNumber?: number,
    autocommit?: boolean,
}

export class AbortTransactionCommand extends Command {
    needsWritableHost() {
        return false;
    }

    async execute(config: MongoClientConfig, host: Host, transaction): Promise<BaseResponse> {
        const cmd: any = {
            abortTransaction: 1,
            $db: 'admin',
        };

        if (transaction) transaction.applyTransaction(cmd);

        return await this.sendAndWait<Request>(cmd);
    }
}
