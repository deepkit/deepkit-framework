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
import { DeepkitClient } from '@deepkit/rpc';
import { BrowserControllerInterface, DatabaseInfo } from '@deepkit/orm-browser-api';
import { asyncOperation } from '@deepkit/core';

@Injectable()
export class ControllerClient {
    protected loadDatabases?: Promise<DatabaseInfo[]>;

    public browser = this.client.controller(BrowserControllerInterface);

    constructor(public client: DeepkitClient) {
    }

    static getServerHost(): string {
        return (location.port === '4200' ? location.hostname + ':8080' : location.host);
    }

    getDatabases(): Promise<DatabaseInfo[]> {
        if (this.loadDatabases) return this.loadDatabases;
        this.loadDatabases = asyncOperation(async (resolve) => {
            resolve(await this.browser.getDatabases());
        });
        return this.loadDatabases;
    }
}
