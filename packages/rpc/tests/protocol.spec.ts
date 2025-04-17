import { expect, test } from '@jest/globals';
import {
    ContextDispatcher,
    contextIdSize,
    flagSize,
    getAction,
    getActionOffset,
    getContextId,
    getContextIdOffset,
    getRandomAddress,
    getRouteDirectDst,
    getRouteDirectPort,
    getRouteDirectSrc,
    getRouteTypeOffset,
    isContextFlag,
    isRouteFlag,
    isTypeFlag,
    MessageFlag,
    readUint16LE,
    routeDirectParamsSize,
    setRouteFlag,
    setTypeFlag,
    writeAction,
    writeContext,
    writeDirectRoute,
    writeUint16LE,
} from '../src/protocol.js';
import { RpcAction } from '../src/model.js';
import { getActions, rpc } from '../src/decorators.js';
import { InjectorModule } from '@deepkit/injector';

test('assume newUin8Array is not copied', () => {
    const buffer = new Uint8Array(32);
    buffer[0] = 42;

    const reply = buffer.subarray(0, 1);

    expect(reply.buffer === buffer.buffer).toBe(true);

    // Modify `reply[0]`
    reply[0] = 99;

    expect(reply[0]).toBe(99);
    expect(buffer[0]).toBe(99);
});

test('header', () => {
    // route type is constant offset
    expect(getRouteTypeOffset(0)).toBe(flagSize);
    expect(getRouteTypeOffset(MessageFlag.RouteDirect)).toBe(flagSize);

    expect(getContextIdOffset(0)).toBe(flagSize);
    expect(getContextIdOffset(MessageFlag.RouteDirect)).toBe(flagSize + routeDirectParamsSize);
    expect(getContextIdOffset(MessageFlag.ContextNew)).toBe(flagSize);

    expect(getActionOffset(0)).toBe(flagSize);

    expect(getActionOffset(MessageFlag.RouteClient)).toBe(flagSize);
    expect(getActionOffset(MessageFlag.RouteServer)).toBe(flagSize);
    expect(getActionOffset(MessageFlag.RouteDirect)).toBe(flagSize + routeDirectParamsSize);

    expect(getActionOffset(MessageFlag.RouteDirect | MessageFlag.ContextExisting)).toBe(flagSize + routeDirectParamsSize + contextIdSize);
    expect(getActionOffset(MessageFlag.RouteDirect | MessageFlag.ContextNew)).toBe(flagSize + routeDirectParamsSize);
    expect(getActionOffset(MessageFlag.RouteDirect | MessageFlag.ContextNone)).toBe(flagSize + routeDirectParamsSize);
});

test('setRouteFlag', () => {
    const message = new Uint8Array(1);
    message[0] = MessageFlag.RouteClient | MessageFlag.ContextExisting | MessageFlag.TypeAck;
    expect(isRouteFlag(message[0], MessageFlag.RouteClient)).toBe(true);
    expect(isRouteFlag(message[0], MessageFlag.RouteServer)).toBe(false);
    expect(isRouteFlag(message[0], MessageFlag.RouteDirect)).toBe(false);

    expect(isContextFlag(message[0], MessageFlag.ContextExisting)).toBe(true);
    expect(isContextFlag(message[0], MessageFlag.ContextNew)).toBe(false);
    expect(isContextFlag(message[0], MessageFlag.ContextNone)).toBe(false);
    expect(isContextFlag(message[0], MessageFlag.ContextEnd)).toBe(false);

    expect(isTypeFlag(message[0], MessageFlag.TypeAck)).toBe(true);
    expect(isTypeFlag(message[0], MessageFlag.TypeAction)).toBe(false);
    expect(isTypeFlag(message[0], MessageFlag.TypeChunk)).toBe(false);
    expect(isTypeFlag(message[0], MessageFlag.TypeError)).toBe(false);

    setRouteFlag(message, MessageFlag.RouteServer);
    expect(isRouteFlag(message[0], MessageFlag.RouteClient)).toBe(false);
    expect(isRouteFlag(message[0], MessageFlag.RouteServer)).toBe(true);
    expect(isRouteFlag(message[0], MessageFlag.RouteDirect)).toBe(false);

    setRouteFlag(message, MessageFlag.RouteDirect);
    expect(isRouteFlag(message[0], MessageFlag.RouteClient)).toBe(false);
    expect(isRouteFlag(message[0], MessageFlag.RouteServer)).toBe(false);
    expect(isRouteFlag(message[0], MessageFlag.RouteDirect)).toBe(true);

    setRouteFlag(message, MessageFlag.RouteClient);
    expect(isRouteFlag(message[0], MessageFlag.RouteClient)).toBe(true);
    expect(isRouteFlag(message[0], MessageFlag.RouteServer)).toBe(false);
    expect(isRouteFlag(message[0], MessageFlag.RouteDirect)).toBe(false);
});

test('setTypeFlag', () => {
    const message = new Uint8Array(1);
    message[0] = MessageFlag.RouteServer | MessageFlag.ContextNew | MessageFlag.TypeAck;
    expect(isRouteFlag(message[0], MessageFlag.RouteServer)).toBe(true);
    expect(isContextFlag(message[0], MessageFlag.ContextNew)).toBe(true);
    expect(isTypeFlag(message[0], MessageFlag.TypeAck)).toBe(true);

    setTypeFlag(message, MessageFlag.TypeChunk);
    expect(isTypeFlag(message[0], MessageFlag.TypeChunk)).toBe(true);
});

test('action', () => {
    class Controller {
        @rpc.action()
        myAction() {

        }
    }

    const module = new InjectorModule([
        Controller,
    ]);

    const actions2 = getActions(Controller);
});

test('dispatcher', () => {
    const dispatcher = new ContextDispatcher;

    let called = 0;
    const ids: number[] = [];
    for (let i = 0; i < 100000; i++) {
        const id = dispatcher.create(() => {
            called++;
        });
        ids.push(id);
    }

    const message = new Uint8Array;
    for (const id of ids) {
        dispatcher.dispatch(id, message);
    }
    expect(called).toBe(100000);
});

test('uint16', () => {
    const message = Buffer.allocUnsafe(4);
    writeUint16LE(message, 0, 1);
    expect(readUint16LE(message, 0)).toBe(1);

    writeUint16LE(message, 0, 126);
    expect(readUint16LE(message, 0)).toBe(126);

    writeUint16LE(message, 2, 20000);
    expect(readUint16LE(message, 0)).toBe(126);
    expect(readUint16LE(message, 2)).toBe(20000);
});

test('message - client - context - ack', () => {
    const message = Buffer.allocUnsafe(32);
    message[0] = MessageFlag.RouteClient | MessageFlag.ContextExisting | MessageFlag.TypeAck;
    writeContext(message, 1);

    expect(isContextFlag(message[0], MessageFlag.ContextExisting)).toBe(true);
    expect(getContextId(message)).toBe(1);
    expect(isTypeFlag(message[0], MessageFlag.TypeAck)).toBe(true);
});

test('message - client - new context - ack', () => {
    const message = Buffer.allocUnsafe(32);
    message[0] = MessageFlag.RouteClient | MessageFlag.ContextNew | MessageFlag.TypeAck;

    expect(isContextFlag(message[0], MessageFlag.ContextNew)).toBe(true);
    expect(isTypeFlag(message[0], MessageFlag.TypeAck)).toBe(true);
});

test('message - client - end context - ack', () => {
    const message = Buffer.allocUnsafe(32);
    message[0] = MessageFlag.RouteClient | MessageFlag.ContextEnd | MessageFlag.TypeAck;
    writeContext(message, 1);

    expect(isContextFlag(message[0], MessageFlag.ContextEnd)).toBe(true);
    expect(getContextId(message)).toBe(1);
    expect(isTypeFlag(message[0], MessageFlag.TypeAck)).toBe(true);
});

test('message - client - no context - ack', () => {
    const message = Buffer.allocUnsafe(32);
    message[0] = MessageFlag.RouteClient | MessageFlag.ContextNone | MessageFlag.TypeAck;

    expect(isContextFlag(message[0], MessageFlag.ContextNone)).toBe(true);
    expect(isTypeFlag(message[0], MessageFlag.TypeAck)).toBe(true);
});

test('message - client - context - action', () => {
    const message = Buffer.allocUnsafe(32);
    message[0] = MessageFlag.RouteClient | MessageFlag.ContextExisting | MessageFlag.TypeAction;
    writeContext(message, 1);
    writeAction(message, RpcAction.Ping);

    expect(isContextFlag(message[0], MessageFlag.ContextExisting)).toBe(true);
    expect(getContextId(message)).toBe(1);
    expect(isTypeFlag(message[0], MessageFlag.TypeAction)).toBe(true);
    expect(getAction(message)).toBe(RpcAction.Ping);
});

test('message - client - no context - action', () => {
    const message = Buffer.allocUnsafe(32);
    message[0] = MessageFlag.RouteClient | MessageFlag.ContextNone | MessageFlag.TypeAction;
    writeAction(message, RpcAction.Ping);

    expect(isContextFlag(message[0], MessageFlag.ContextNone)).toBe(true);
    expect(isTypeFlag(message[0], MessageFlag.TypeAction)).toBe(true);
    expect(getAction(message)).toBe(RpcAction.Ping);
});

// with RouteDirect
const src = getRandomAddress();
const dst = getRandomAddress();
const port = 67;

test('message - direct route - context - ack', () => {
    const message = Buffer.allocUnsafe(255);
    message[0] = MessageFlag.RouteDirect | MessageFlag.ContextExisting | MessageFlag.TypeAck;
    writeDirectRoute(message, src, dst, port);
    writeContext(message, 1);

    expect(isContextFlag(message[0], MessageFlag.ContextExisting)).toBe(true);
    expect(getContextId(message)).toBe(1);
    expect(getRouteDirectSrc(message)).toEqual(src);
    expect(getRouteDirectDst(message)).toEqual(dst);
    expect(getRouteDirectPort(message)).toBe(port);
    expect(isTypeFlag(message[0], MessageFlag.TypeAck)).toBe(true);
});

test('message - direct route - no context - ack', () => {
    const message = Buffer.allocUnsafe(255);
    message[0] = MessageFlag.RouteDirect | MessageFlag.ContextNone | MessageFlag.TypeAck;
    writeDirectRoute(message, src, dst, port);

    expect(isContextFlag(message[0], MessageFlag.ContextNone)).toBe(true);
    expect(getRouteDirectSrc(message)).toEqual(src);
    expect(getRouteDirectDst(message)).toEqual(dst);
    expect(getRouteDirectPort(message)).toBe(port);
    expect(isTypeFlag(message[0], MessageFlag.TypeAck)).toBe(true);
});

test('message - direct route - context - action', () => {
    const message = Buffer.allocUnsafe(255);
    message[0] = MessageFlag.RouteDirect | MessageFlag.ContextExisting | MessageFlag.TypeAction;
    writeDirectRoute(message, src, dst, port);
    writeContext(message, 1);
    writeAction(message, RpcAction.Ping);

    expect(isContextFlag(message[0], MessageFlag.ContextExisting)).toBe(true);
    expect(getContextId(message)).toBe(1);
    expect(getRouteDirectSrc(message)).toEqual(src);
    expect(getRouteDirectDst(message)).toEqual(dst);
    expect(getRouteDirectPort(message)).toBe(port);
    expect(isTypeFlag(message[0], MessageFlag.TypeAction)).toBe(true);
    expect(getAction(message)).toBe(RpcAction.Ping);
});

test('message - direct route - no context - action', () => {
    const message = Buffer.allocUnsafe(255);
    message[0] = MessageFlag.RouteDirect | MessageFlag.ContextNone | MessageFlag.TypeAction;
    writeDirectRoute(message, src, dst, port);
    writeAction(message, RpcAction.Ping);

    expect(isContextFlag(message[0], MessageFlag.ContextNone)).toBe(true);
    expect(getRouteDirectSrc(message)).toEqual(src);
    expect(getRouteDirectDst(message)).toEqual(dst);
    expect(getRouteDirectPort(message)).toBe(port);
    expect(isTypeFlag(message[0], MessageFlag.TypeAction)).toBe(true);
    expect(getAction(message)).toBe(RpcAction.Ping);
});
