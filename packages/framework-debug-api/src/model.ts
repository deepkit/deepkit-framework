/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { AutoIncrement, entity, PrimaryKey } from '@deepkit/type';

@entity.name('deepkit/debugger/request')
export class DebugRequest {
    id: number & PrimaryKey & AutoIncrement = 0;
    version: number = 0;
    created: Date = new Date;
    statusCode?: number;
    logs: number = 0;

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

    times: { [name: string]: number } = {};

    constructor(
        public method: string,

        public url: string,
        public clientIp: string,
    ) {
    }
}
