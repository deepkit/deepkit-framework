import { DataEvent, EventToken, EventTokenSync } from '@deepkit/event';
import { InjectorContext } from '@deepkit/injector';
import { RpcKernelConnection } from './server/kernel';
import { RpcControllerAccess, Session } from './server/security';

export type WithFail<T> = Omit<T, 'phase'> & { phase: 'fail'; error: Error };

export interface RpcConnectionEvent {
    context: {
        connection: RpcKernelConnection;
        injector: InjectorContext;
    };
}

export const onRpcConnection = new EventTokenSync<DataEvent<RpcConnectionEvent>>('rpc.connection');

export interface RpcConnectionCloseEvent extends RpcConnectionEvent {
    /**
     * There could be multiple reasons why a connection is closed. This could be a normal
     * close, an error, or a timeout.
     * If the connection was closed because of an error, this property contains the error object.
     */
    reason: string | Error;
}

export const onRpcConnectionClose = new EventTokenSync<DataEvent<RpcConnectionCloseEvent>>('rpc.connectionClose');

/**
 * All times are in milliseconds (using performance.now()).
 */
export interface RpcActionTimings {
    /**
     * The start of the action (performance.now())
     */
    start: number;

    /**
     * The end of the action (performance.now())
     */
    end: number;

    /**
     * Time it took to check the controller access (since start)
     */
    types?: number;

    /**
     * Time it took to parse the body (since start)
     */
    parseBody?: number;

    /**
     * Time it took to validate the parameters (since start)
     */
    validate?: number;

    /**
     * Time it took to check the controller access (since start)
     */
    controllerAccess?: number;
}

export interface RpcActionEventBase extends RpcConnectionEvent {
    phase: 'start' | 'success';
    controller: RpcControllerAccess;
    timing: RpcActionTimings;
}

export type RpcActionEvent = RpcActionEventBase | WithFail<RpcActionEventBase>;

export const onRpcAction = new EventTokenSync<DataEvent<RpcActionEvent>>('rpc.action');

export interface RpcAuthEventStart extends RpcConnectionEvent {
    token: any;
    phase: 'start';
    /**
     * Set this to the session object if the authentication was successful.
     * If set this will bypass RpcKernelSecurity and directly use this session.
     */
    session?: Session;
}

export interface RpcAuthEventSuccess extends RpcConnectionEvent {
    token: any;
    phase: 'success';
    session: Session;
}

export type RpcAuthEvent = RpcAuthEventStart | RpcAuthEventSuccess | WithFail<RpcAuthEventStart>;

export const onRpcAuth = new EventToken<DataEvent<RpcAuthEvent>>('rpc.auth');

export interface RpcControllerAccessEventStart extends RpcConnectionEvent {
    phase: 'start';
    session: Session;
    controller: RpcControllerAccess;
    /**
     * Set this to true if you want to grant access to the controller.
     * If set this will bypass RpcKernelSecurity and directly grant access.
     */
    granted?: boolean;
}

export interface RpcControllerAccessEventBase extends RpcConnectionEvent {
    phase: 'success' | 'denied';
    session: Session;
    controller: RpcControllerAccess;
}

export type RpcControllerAccessEvent = RpcControllerAccessEventStart | RpcControllerAccessEventBase | WithFail<RpcControllerAccessEventBase>;

export const onRpcControllerAccess = new EventToken<DataEvent<RpcControllerAccessEvent>>('rpc.controllerAccess');
