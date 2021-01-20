/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { BaseImplementation, ElementNotFoundException } from './base';

interface ItemElement<T> {
    item: T,
    dependencies: T[],
    visited: boolean,
}

/**
 * A topological sort implementation based on  arrays.
 *
 * @author Marc J. Schmidt <marc@marcjschmidt.de>
 */
export class ArraySort<T = string> extends BaseImplementation<T> {
    protected elements = new Map<T, ItemElement<T>>();

    protected sorted: T[] = [];

    public set(elements: Map<T, T[]>) {
        for (const [key, value] of elements.entries()) {
            this.add(key, value);
        }
    }

    public add(element: T, dependencies: T[] = []) {
        this.elements.set(element, {
            item: element,
            dependencies: dependencies,
            visited: false,
        });
    }

    public reset() {
        for (const element of this.elements.values()) {
            element.visited = false;
        }
    }

    /**
     * Visits element and handles it dependencies, queues to internal sorted list in the right order.
     *
     * @throws CircularDependencyException if a circular dependency has been found
     * @throws ElementNotFoundException if a dependency can not be found
     */
    protected visit(element: ItemElement<T>, parents?: Set<T>) {
        if (parents) this.throwCircularExceptionIfNeeded(element.item, parents);

        if (!element.visited) {
            element.visited = true;

            if (element.dependencies.length) {
                parents = parents || new Set<T>();
                parents.add(element.item);

                for (const dependency of element.dependencies) {
                    let item = this.elements.get(dependency);
                    if (!item) throw new ElementNotFoundException(element.item, dependency);
                    this.visit(item, parents);
                }
            }

            this.addToList(element);
        }
    }

    protected addToList(element: ItemElement<T>) {
        this.sorted.push(element.item);
    }

    /**
     * Sorts dependencies and returns internal used data structure.
     *
     * @throws CircularDependencyException if a circular dependency has been found
     * @throws ElementNotFoundException if a dependency can not be found
     */
    public sort() {
        return this.doSort();
    }

    protected doSort(): T[] {
        this.sorted = [];

        for (const element of this.elements.values()) {
            this.visit(element);
        }

        return this.sorted;
    }
}
