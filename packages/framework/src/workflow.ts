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

import {capitalize, ClassType, CustomError, getClassName, isArray, toFastProperties} from '@deepkit/core';
import {ExtractClassType} from '@deepkit/type';
import {BaseEvent, EventDispatcher, EventToken} from './event';

interface WorkflowTransition<T> {
    from: keyof T,
    to: keyof T,
    label?: string;
}

export class WorkflowEvent extends BaseEvent {
    public nextState?: any;
    public nextStateEvent?: any;

    /**
     * @see WorkflowNextEvent.next
     */
    next(nextState: string, event?: any) {
        this.nextState = nextState;
        this.nextStateEvent = event;
    }
}

export type WorkflowPlaces = { [name: string]: ClassType<WorkflowEvent> };

export interface WorkflowNextEvent<T extends WorkflowPlaces> {
    nextState?: keyof T & string;

    /**
     * Schedule to apply the next workflow step when all event listeners have been called.
     */
    next<S extends keyof T & string>(nextState: S, event?: ExtractClassType<T[S]>): void;
}

export type WorkflowDefinitionEvents<T extends WorkflowPlaces> = {
    [K in keyof T & string as `on${Capitalize<K>}`]: EventToken<BaseEvent & Omit<ExtractClassType<T[K]>, 'next' | 'nextState'> & WorkflowNextEvent<T>>
}

export class WorkflowDefinition<T extends WorkflowPlaces> {
    protected transitions: WorkflowTransition<T>[] = [];
    protected tokens: { [name in keyof T]?: EventToken<any> } = {};
    protected next: {[name in keyof T]?: (keyof T)[]} = {};

    constructor(
        public readonly name: string,
        public readonly places: T,
        transitions: WorkflowTransitions<T> = {}
    ) {
        for (const name in this.places) {
            if (!this.places.hasOwnProperty(name)) continue;
            const token = new EventToken(name, this.places[name]);
            this.tokens[name] = token;
            (this as any)['on' + capitalize(name)] = token;
        }
        for (const [i, value] of Object.entries(transitions)) {
            if (isArray(value)) {
                for (const v of value) this.addTransition(i, v);
            } else if (value !== undefined) {
                this.addTransition(i, value);
            }
        }
        toFastProperties(this.tokens);
        toFastProperties(this.next);
    }

    getEventToken<K extends keyof T>(name: K): EventToken<ExtractClassType<T[K]>> {
        if (!this.tokens[name]) throw new Error(`No event token found for ${name}`);

        return this.tokens[name]!;
    }

    addTransition(from: keyof T, to: keyof T, label?: string) {
        this.transitions.push({from, to, label});
        if (!this.next[from]) this.next[from] = [];
        this.next[from]!.push(to);
    }

    create(state: keyof T, eventDispatcher?: EventDispatcher): Workflow<T> {
        return new Workflow(this, new WorkflowStateSubject(state), eventDispatcher);
    }

    getTransitionsFrom(state: keyof T): (keyof T)[] {
        return this.next[state]! || [];
    }
}

type WorkflowTransitions<T extends WorkflowPlaces> = { [name in keyof T]?: (keyof T & string) | (keyof T & string)[] };

export function createWorkflow<T extends WorkflowPlaces>(
    name: string,
    definition: T,
    transitions: WorkflowTransitions<T> = {}
): WorkflowDefinition<T> & WorkflowDefinitionEvents<T> {
    return new WorkflowDefinition(name, definition, transitions) as any;
}

export interface WorkflowState<T> {
    get(): keyof T;

    set(v: keyof T): void;
}

export class WorkflowStateSubject<T> implements WorkflowState<T> {
    constructor(public value: keyof T) {
    }

    get() {
        return this.value;
    }

    set(v: keyof T) {
        this.value = v;
    }
}

export class WorkflowError extends CustomError {}

export class Workflow<T extends WorkflowPlaces> {
    protected events: {[name in keyof T]?: Function} = {};

    constructor(
        public definition: WorkflowDefinition<T>,
        public state: WorkflowState<T>,
        private eventDispatcher?: EventDispatcher,
    ) {

    }

    can(nextState: keyof T): boolean {
        return this.definition.getTransitionsFrom(this.state.get()).includes(nextState);
    }

    /**
     * @throws WorkflowError when next state is not possible to apply.
     */
    async apply<K extends keyof T>(
        nextState: K,
        event?: ExtractClassType<T[K]>,
    ): Promise<void> {
        if (!this.can(nextState)) throw new WorkflowError(`Can not apply state ${nextState} from state ${this.state.get()}. There's no transition between them or it was blocked.`);

        const placeEventClassType = this.definition.places[nextState];
        if (!event && placeEventClassType !== WorkflowEvent) {
            throw new Error(`State ${nextState} requires a custom WorkflowEvent ${getClassName(placeEventClassType)}`);
        }

        if (this.eventDispatcher) {
            const usedEvent = event || new WorkflowEvent() as ExtractClassType<T[K]>;
            if (event && !(event instanceof this.definition.places[nextState])) {
                throw new Error(`State ${nextState} got the wrong event. Expected ${getClassName(this.definition.places[nextState])}, got ${getClassName(event)}`);
            }

            const token = this.definition.getEventToken(nextState);
            // let caller = this.events[nextState];
            // if (!caller) {
            //     caller = this.eventDispatcher
            // }

            await this.eventDispatcher.dispatch(token, usedEvent);
            if (usedEvent.isStopped()) return;

            if (usedEvent.nextState) {
                this.state.set(nextState);
                await this.apply(usedEvent.nextState, usedEvent.nextStateEvent);
                return;
            }
        }

        this.state.set(nextState);
    }

    isDone(): boolean {
        return this.definition.getTransitionsFrom(this.state.get()).length === 0;
    }
}
