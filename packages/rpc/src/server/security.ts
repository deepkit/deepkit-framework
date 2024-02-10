/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassType } from '@deepkit/core';
import { RpcKernelBaseConnection } from './kernel.js';

export class Session {
    constructor(
        public readonly username: string,
        public readonly token: any,
    ) {
    }

    public isAnonymous(): boolean {
        return undefined === this.token;
    }
}

export interface RpcControllerAccess {
    controllerName: string;
    controllerClassType: ClassType;
    actionName: string;
    actionGroups: string[];
    connection: RpcKernelBaseConnection;
    actionData: { [name: string]: any };
}

export class RpcKernelSecurity {
    async hasControllerAccess(session: Session, controllerAccess: RpcControllerAccess): Promise<boolean> {
        return true;
    }

    async isAllowedToRegisterAsPeer(session: Session, peerId: string): Promise<boolean> {
        return true;
    }

    async isAllowedToSendToPeer(session: Session, peerId: string): Promise<boolean> {
        return true;
    }

    async authenticate(token: any, connection: RpcKernelBaseConnection): Promise<Session> {
        throw new Error('Authentication not implemented');
    }

    transformError(err: Error) {
        return err;
    }
}

export class SessionState {
    protected session: Session = new Session('anon', undefined);

    public setSession(session: Session) {
        this.session = session;
    }

    public getSession(): Session {
        return this.session;
    }
}
