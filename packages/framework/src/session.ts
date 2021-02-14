/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { t } from '@deepkit/type';
import { injectable } from '@deepkit/injector';

/**
 * This is the default session object, that can be used in your application.
 *
 * If you want to receive the Session object you can simply use this Session class as dependency injection token.
 * However, this will always create a new session (creating a session id + store it in the session storage).
 * If you simply want to check whether a session exists (user has a valid authenticaton token/cookie), use
 * SessionHandler.
 *
 * If you need more fields, you can create your own Session class. Make sure to
 * annotate all fields using `@t` of @deepkit/type, since the whole object is serialized
 * in a session storage (either memory, local file system, or external databases like redis/mysql/etc).
*/
export class Session {
    @t.map(t.any) data: { [name: string]: any } = {};

    @t createdAt: Date = new Date;

    @t.array(t.string) groups: string[] = [];

    constructor(
        @t public readonly id: string,
        @t public readonly username?: string
    ) {
    }

    public isAnonymous(): boolean {
        return undefined === this.username;
    }
}

/**
 *
 */
@injectable()
export class SessionHandler {
    protected session?: Session;

    public setSession(session: Session | undefined) {
        this.session = session;
    }

    public hasSession(): boolean {
        return this.session !== undefined;
    }

    public getSessionOrUndefined(): Session | undefined {
        return this.session;
    }

    public getSession(): Session {
        if (!this.session) {
            throw new Error('No session loaded');
        }

        return this.session;
    }
}
