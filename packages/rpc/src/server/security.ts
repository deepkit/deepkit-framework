/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { RpcAction } from '../decorators';

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

export class RpcKernelSecurity {
    async hasControllerAccess(session: Session, action: RpcAction): Promise<boolean> {
        return true;
    }

    async isAllowedToRegisterAsPeer(session: Session, peerId: string): Promise<boolean> {
        return true;
    }

    async isAllowedToSendToPeer(session: Session, peerId: string): Promise<boolean> {
        return true;
    }

    async authenticate(token: any): Promise<Session> {
        throw new Error('Authentication not implemented');
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
