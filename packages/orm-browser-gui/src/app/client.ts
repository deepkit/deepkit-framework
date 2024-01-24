/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { Injectable } from '@angular/core';

import { asyncOperation } from '@deepkit/core';
import { BrowserControllerInterface, DatabaseInfo } from '@deepkit/orm-browser-api';
import { DeepkitClient } from '@deepkit/rpc';

@Injectable()
export class ControllerClient {
    protected loadDatabases?: Promise<DatabaseInfo[]>;

    public browser = this.client.controller(BrowserControllerInterface);

    constructor(public client: DeepkitClient) {}

    static getServerHost(): string {
        const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
        return proto + (location.port === '4200' ? location.hostname + ':8080' : location.host) + location.pathname;
    }

    setController(name: string) {
        this.browser = this.client.controller<BrowserControllerInterface>(name);
    }

    getDatabases(): Promise<DatabaseInfo[]> {
        if (this.loadDatabases) return this.loadDatabases;
        this.loadDatabases = asyncOperation(async resolve => {
            resolve(await this.browser.getDatabases());
        });
        return this.loadDatabases;
    }
}
