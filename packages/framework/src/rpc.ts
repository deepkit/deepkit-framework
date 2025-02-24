/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { InjectorContext } from '@deepkit/injector';
import {
    rpcActionType,
    RpcControllerAccess,
    RpcKernel,
    RpcKernelBaseConnection,
    RpcKernelConnection,
    RpcMessage,
    RpcMessageBuilder,
    RpcServerAction,
    TransportConnection,
} from '@deepkit/rpc';
import { FrameCategory, Stopwatch } from '@deepkit/stopwatch';
import { ClassType } from '@deepkit/core';
import { AppModule } from '@deepkit/app';

export class RpcControllers {
    public readonly controllers = new Map<string, { controller: ClassType, module: AppModule<any> }>();
}

export class RpcInjectorContext extends InjectorContext {
}

export class RpcServerActionWithStopwatch extends RpcServerAction {
    stopwatch?: Stopwatch;

    protected async hasControllerAccess(controllerAccess: RpcControllerAccess): Promise<boolean> {
        const frame = this.stopwatch ? this.stopwatch.start('RPC/controllerAccess') : undefined;

        try {
            return await super.hasControllerAccess(controllerAccess);
        } finally {
            if (frame) frame.end();
        }
    }

    async handleAction(message: RpcMessage, response: RpcMessageBuilder): Promise<void> {
        const body = message.parseBody<rpcActionType>();
        const frame = this.stopwatch ? this.stopwatch.start(body.method + '() [' + body.controller + ']', FrameCategory.rpc, true) : undefined;
        if (frame) {
            try {
                const types = await this.loadTypes(body.controller, body.method);
                const value: { args: any[] } = message.parseBody(types.actionCallSchema);
                frame.data({ method: body.method, controller: body.controller, arguments: value.args });
            } catch {
            }
        }

        try {
            if (frame) return await frame.run(() => super.handleAction(message, response));
            return await super.handleAction(message, response);
        } finally {
            if (frame) frame.end();
        }
    }
}

export class RpcKernelConnectionWithStopwatch extends RpcKernelConnection {
    protected actionHandler = new RpcServerActionWithStopwatch(this.cache, this, this.controllers, this.injector, this.security, this.sessionState, this.logger, this.hooks);
    stopwatch?: Stopwatch;

    setStopwatch(stopwatch: Stopwatch) {
        this.stopwatch = stopwatch;
        this.actionHandler.stopwatch = stopwatch;
    }

    protected async authenticate(message: RpcMessage, response: RpcMessageBuilder): Promise<void> {
        const frame = this.stopwatch ? this.stopwatch.start('RPC/authenticate', FrameCategory.rpcAuthenticate, true) : undefined;
        try {
            return await super.authenticate(message, response);
        } finally {
            if (frame) frame.end();
        }
    }
}

export class RpcKernelWithStopwatch extends RpcKernel {
    protected RpcKernelConnection = RpcKernelConnectionWithStopwatch;

    stopwatch?: Stopwatch;

    createConnection(transport: TransportConnection, injector?: InjectorContext): RpcKernelBaseConnection {
        const connection = super.createConnection(transport, injector);
        if (this.stopwatch && connection instanceof RpcKernelConnectionWithStopwatch) {
            connection.setStopwatch(this.stopwatch);
        }
        return connection;
    }
}
