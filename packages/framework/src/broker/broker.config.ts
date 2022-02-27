/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

export class BrokerConfig {
    /**
     * @description If startOnBootstrap is true, the broker server stats at this address. Unix socket path or host:port combination
     */
    listen: string = 'localhost:8811';

    /**
     * @description If a different broker server should be used, this is its address. Unix socket path or host:port combination.
     */
    host: string = 'localhost:8811';

    /**
     * @description Automatically starts a single broker in the main process. Disable it if you have a custom broker node.
     */
    startOnBootstrap: boolean = false;
}
