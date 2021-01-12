/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG
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

import { ClassType } from "@deepkit/core";
import { RpcKernelSecurity, Session } from "@deepkit/rpc";
import { InjectorContext } from "./injector/injector";

export class RpcInjectorContext extends InjectorContext { }

export class DeepkitRpcSession extends Session { }

export class DeepkitRpcSecurity extends RpcKernelSecurity<DeepkitRpcSession> {
    async hasControllerAccess(session: DeepkitRpcSession, classType: ClassType, method: string): Promise<boolean> {
        return true;
    }

    async isAllowedToRegisterAsPeer(session: DeepkitRpcSession, peerId: string): Promise<boolean> {
        return true;
    }

    async isAllowedToSendToPeer(session: DeepkitRpcSession, peerId: string): Promise<boolean> {
        return true;
    }

    async authenticate(token: any): Promise<DeepkitRpcSession> {
        throw new Error('Authentication not implemented');
    }
}
