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
import { RpcWebSocketClient } from '@deepkit/rpc';
import { ApiConsoleApi, ApiDocument, ApiEntryPoints } from '@deepkit/api-console-api';
import { LiveSubject } from '@deepkit/ui-library';

@Injectable({ providedIn: 'root' })
export class ControllerClient {
    entryPoints = new LiveSubject<ApiEntryPoints>((subject) => {
        this.api.getEntryPoints().then(v => subject.next(v));
    });

    document = new LiveSubject<ApiDocument>((subject) => {
        this.api.getDocument().then(v => subject.next(v));
    });

    client = new RpcWebSocketClient(ControllerClient.getServerHost());

    constructor() {
        this.client.transporter.reconnected.subscribe(() => {
            this.entryPoints.reload();
            this.document.reload();
        });
        this.client.transporter.disconnected.subscribe(() => {
            this.tryToConnect();
        });
    }

    tryToConnect() {
        this.client.connect().catch(() => {
            setTimeout(() => {
                this.tryToConnect();
            }, 1_000);
        });
    }

    setController(name: string) {
        this.api = this.client.controller<ApiConsoleApi>(name);
    }

    public api = this.client.controller(ApiConsoleApi);

    static getServerHost(): string {
        const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
        return proto + (location.port === '4200' ? location.hostname + ':8080' : location.host) + location.pathname;
    }
}
