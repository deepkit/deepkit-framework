

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

import {performance} from 'perf_hooks';

export const enum TraceType {
    request,
    cli,
    rpc,
    workflowTransition,
    event,
    other,
}

export interface TraceFrameRequest {
    type: TraceType.request;
    id: number;
}

export interface TraceFrameEvent {
    type: TraceType.event;
    name: string;
}

export interface TraceFrameRpc {
    type: TraceType.rpc;
    id: string;
}

export interface TraceFrameWorkflowTransition {
    type: TraceType.workflowTransition;
    id: string;
}

export const enum TraceFrameMode {
    start,
    end,
    data,
}

export interface TraceFrameBasic {
    stamp: number;
    mode: TraceFrameMode;
}

export type TraceFrameTypes = TraceFrameRequest | TraceFrameEvent | TraceFrameRpc | TraceFrameWorkflowTransition;
export type TraceFrame = TraceFrameBasic & TraceFrameTypes;

export class Tracer {
    protected stack: { name: string, level: number }[] = [];

    protected frames: TraceFrame[] = [];

    public start(type: TraceFrameTypes, name: string, data?: any) {
        this.stack.push({name, level: this.stack.length});

        const frame = Object.assign({stamp: performance.now(), mode: TraceFrameMode.start}, type);
        this.frames.push(frame);
    }

    public end(name: string) {
        const last = this.stack.pop();
        if (!last) throw new Error(`Tracer race condition: could not end ${name}, stack empty`);
        if (name !== last.name) throw new Error(`Tracer race condition: could not end ${name}, ${last.name} is expected`);

        const frame = Object.assign({stamp: performance.now(), mode: TraceFrameMode.start});
        this.frames.push(frame);
    }
}
