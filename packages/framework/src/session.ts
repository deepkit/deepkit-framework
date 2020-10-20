/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import {injectable} from './injector/injector';

export class Session {
    constructor(
        public readonly username: string,
        public readonly token: any,
    ) {
    }

    public isAnonymouse(): boolean {
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
            throw new Error('No session given.');
        }

        return this.session;
    }
}
