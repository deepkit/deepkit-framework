/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { entity, t } from '@deepkit/type';

@entity.name('deepkit/debugger/request')
export class DebugRequest {
    @t.primary.autoIncrement id: number = 0;
    @t version: number = 0;
    @t created: Date = new Date;
    @t.optional statusCode?: number;
    @t logs: number = 0;

    /*
        db time:
            - total
            - query time
        message bus:
            - total time
            - total bytes
            - total latencies
            - messages
                - time
                - bytes
                - latency
        response/request:
            - header
            - body
        events:
            - name
            - time
        template:
            - name
            - time
        logs:
     */

    @t.map(t.number) times: { [name: string]: number } = {};

    constructor(
        @t.name('method') public method: string,

        @t.name('url') public url: string,
        @t.name('clientIp') public clientIp: string,
    ) {
    }
}
