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
import { BaseResponse, Command } from './command';
import { MongoClientConfig } from '../config';
import { Host } from '../host';

export class Response extends t.extendClass(BaseResponse, {
    id: { id: t.uuid },
}) {
}

const Request = t.schema({
    startSession: t.number,
    $db: t.string,
    lsid: t.type({id: t.uuid}).optional,
    txnNumber: t.number,
    autocommit: t.boolean,
});

export class StartSessionCommand extends Command {
    needsWritableHost() {
        return false;
    }

    async execute(config: MongoClientConfig, host: Host, transaction): Promise<Response> {
        const cmd: any = {
            startSession: 1,
            $db: 'admin',
        };

        if (transaction) transaction.applyTransaction(cmd);

        return await this.sendAndWait(Request, cmd, Response);
    }
}
