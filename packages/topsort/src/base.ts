/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

export class CircularDependencyException<T> extends Error {
    constructor(public readonly nodes: T[]) {
        super(`Circular reference found ${nodes.map(v => (v as any).constructor.name).join(' -> ')}`);
    }

    public getStart(): T {
        return this.nodes[0]
    }

    public getEnd(): T {
        return this.nodes[this.nodes.length - 1];
    }
}

export class ElementNotFoundException<T> extends Error {
    constructor(public readonly element: T, public readonly dependency: T) {
        super('Element dependency not found');
    }
}

export abstract class BaseImplementation<T> {
    public circularInterceptor?: (items: T[]) => void;

    constructor(public throwCircularDependency: boolean = true) {
    }

    protected throwCircularExceptionIfNeeded(element: T, parents: Set<T>) {
        if (!this.throwCircularDependency) return;

        if (parents.has(element)) {
            const nodes = [...parents.values()];

            if (this.circularInterceptor) {
                this.circularInterceptor(nodes);
            } else {
                throw new CircularDependencyException(nodes);
            }
        }
    }
}
