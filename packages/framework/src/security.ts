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

import {ClassType} from '@deepkit/core';
import {Session} from './session';

export class SecurityStrategy {
    /**
     * Method to check whether given session (created by authenticate) has access to controller::action.
     */
    public async hasAccess<T>(session: Session | undefined, controller: ClassType<T>, action: string): Promise<boolean> {
        return true;
    }

    /**
     * Method to check whether given session (created by authenticate) is allowed to register peer controller of name `controllerName`.
     */
    public async isAllowedToRegisterPeerController<T>(session: Session | undefined, controllerName: string): Promise<boolean> {
        return true;
    }

    /**
     * Method to check whether given session (created by authenticate) is allowed to send messages to peer controller of name `controllerName`.
     */
    public async isAllowedToSendToPeerController<T>(session: Session | undefined, controllerName: string): Promise<boolean> {
        return true;
    }

    /**
     * Authenticates the current connection.
     */
    public async authenticate(token: any): Promise<Session> {
        return new Session('anon', undefined);
    }
}
