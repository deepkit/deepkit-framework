/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { Server } from 'http';

export class ApplicationConfig {
    host: string = 'localhost'; //binding to 127.0.0.1 is roughly 20% slower.

    port: number = 8080;

    path: string = '/';

    workers: number = 1;

    server?: Server;

    maxPayload?: number;

    publicDir: string = 'public/';

    debug: boolean = false;

    migrationDir: string = 'migration/';
}
