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
import { Collection, DeepkitClient } from '@deepkit/rpc';
import { DebugControllerInterface, DebugRequest, Workflow } from '@deepkit/framework-debug-api';

@Injectable()
export class ControllerClient {
    protected requests?: Promise<Collection<DebugRequest>>;
    protected workflows: { [name: string]: Promise<Workflow> } = {};

    public readonly debug = this.client.controller(DebugControllerInterface);

    static getServerHost(): string {
        const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
        return proto + (location.port === '4200' ? location.hostname + ':8080' : location.host) + location.pathname;
    }

    constructor(public client: DeepkitClient) {
        client.transporter.disconnected.subscribe(() => {
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

    public getWorkflow(name: string): Promise<Workflow> {
        if (this.workflows[name]) return this.workflows[name];
        return this.workflows[name] = this.debug.getWorkflow(name);
    }

    // public getHttpRequests(): Promise<Collection<DebugRequest>> {
    //     if (this.requests) return this.requests;
    //     return this.requests = this.debug.httpRequests();
    // }
}
