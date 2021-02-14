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
import { RpcKernelSecurity, Session } from '@deepkit/rpc';
import { InjectorContext } from '@deepkit/injector';

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
