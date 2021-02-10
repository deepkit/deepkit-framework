/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { performance } from 'perf_hooks';

export const enum TraceType {
    end,
    request,
    cli,
    rpc,
    workflowTransition,
    event,
    other,
}

export interface TraceFrameBase {
    id: number;
    stamp: number;
}

export interface TraceFrameRequest {
    type: TraceType.request;
    requestId: number;
}

export interface TraceFrameEvent {
    type: TraceType.event;
    eventName: string;
}

export interface TraceFrameRpc {
    type: TraceType.rpc;
    actionId: string;
}

export interface TraceFrameWorkflowTransition {
    type: TraceType.workflowTransition;
    transitionName: string;
}

export interface TraceFrameEnd {
    type: TraceType.end;
    id: number;
    stamp: number;
}

export type TraceFrameTypes = TraceFrameRequest | TraceFrameEvent | TraceFrameRpc | TraceFrameWorkflowTransition;
export type TraceFrame = (TraceFrameBase & TraceFrameTypes) | TraceFrameEnd;

export type TraceDone = () => void;

export class Tracer {
    protected id: number = 0;
    // protected stack: { name: string, level: number }[] = [];

    protected frames: TraceFrame[] = [];

    public start(type: TraceFrameTypes): TraceDone {
        // this.stack.push({ level: this.stack.length });

        const id = this.id++;
        const frame = Object.assign({ id, stamp: performance.now() }, type);
        this.frames.push(frame);

        return () => {
            this.frames.push({ id, type: TraceType.end, stamp: performance.now() });
        };
    }

    // public end(name: string) {
    //     const last = this.stack.pop();
    //     if (!last) throw new Error(`Tracer race condition: could not end ${name}, stack empty`);
    //     if (name !== last.name) throw new Error(`Tracer race condition: could not end ${name}, ${last.name} is expected`);


    //     const frame = Object.assign({ stamp: performance.now(), mode: TraceFrameMode.end });
    //     this.frames.push(frame);
    // }
}
