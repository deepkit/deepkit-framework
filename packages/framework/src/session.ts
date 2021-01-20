/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { injectable } from './injector/injector';

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

@injectable()
export class SessionStack {
    protected session?: Session;

    public setSession(session: Session | undefined) {
        this.session = session;
    }

    public isSet(): boolean {
        return this.session !== undefined;
    }

    public getSessionOrUndefined(): Session | undefined {
        return this.session;
    }

    public getSession(): Session {
        if (!this.session) {
            throw new Error('No session given');
        }

        return this.session;
    }
}
