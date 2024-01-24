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

import { DebugControllerInterface, DebugMediaInterface, DebugRequest, Workflow } from '@deepkit/framework-debug-api';
import { Collection, RpcWebSocketClient } from '@deepkit/rpc';

@Injectable()
export class ControllerClient {
    protected requests?: Promise<Collection<DebugRequest>>;
    protected workflows: { [name: string]: Promise<Workflow> } = {};

    public readonly debug = this.client.controller(DebugControllerInterface);
    public readonly media = this.client.controller(DebugMediaInterface);

    static getServerHost(): string {
        const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
        return proto + (location.port === '4200' ? location.hostname + ':8080' : location.host) + location.pathname;
    }

    constructor(public client: RpcWebSocketClient) {
        client.transporter.disconnected.subscribe(() => {
            this.tryToConnect();
        });
    }

    getUrl(path: string): string {
        return (
            location.protocol + '//' + (location.port === '4200' ? location.hostname + ':8080' : location.host) + path
        );
    }

    tryToConnect() {
        this.client.connect().catch(() => {
            setTimeout(() => {
                this.tryToConnect();
            }, 1_000);
        });
    }

    public getWorkflow(name: string): Promise<Workflow> {
        if (this.workflows[name] != undefined) return this.workflows[name];
        return (this.workflows[name] = this.debug.getWorkflow(name));
    }

    // public getHttpRequests(): Promise<Collection<DebugRequest>> {
    //     if (this.requests) return this.requests;
    //     return this.requests = this.debug.httpRequests();
    // }
}
