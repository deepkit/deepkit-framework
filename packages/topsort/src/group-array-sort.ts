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

interface ItemElement<T, TYPE> {
    item: T;
    type: TYPE;
    dependencies: T[],
    dependenciesCount: number;
    visited: boolean;
    addedAtLevel: number;
}

interface Group<T> {
    type: T;
    level: number;
    position: number;
    length: number;
}

export class GroupArraySort<T = string, TYPE = string> extends BaseImplementation<T> {
    protected elements = new Map<T, ItemElement<T, TYPE>>();
    protected sorted: T[] = [];
    protected position: number = 0;
    public groups: Group<TYPE>[] = [];
    protected groupLevel: number = 0;

    public sameTypeExtraGrouping: boolean = false;
    public throwOnNonExistingDependency: boolean = true;

    set(elements: Map<{ item: T, type: TYPE }, T[]>) {
        for (const [key, deps] of elements.entries()) {
            this.add(key.item, key.type, deps);
        }
    }

    public add(item: T, type: TYPE, dependencies: T[] = []) {
        this.elements.set(item, {
            item, type, dependencies,
            dependenciesCount: dependencies.length,
            visited: false,
            addedAtLevel: -1,
        });
    }

    public visit(element: ItemElement<T, TYPE>, parents?: Set<T>): number {
        if (parents) this.throwCircularExceptionIfNeeded(element.item, parents);

        if (!element.visited) {
            element.visited = true;

            let minLevel = -1;

            if (element.dependencies.length) {
                parents = parents || new Set<T>();
                parents.add(element.item);

                for (const dependency of element.dependencies) {
                    let item = this.elements.get(dependency);
                    if (!item) {
                        if (this.throwOnNonExistingDependency) {
                            throw new ElementNotFoundException(element.item, dependency);
                        }
                        continue;
                    }

                    const addedAtGroupLevel = this.visit(item, parents);
                    if (addedAtGroupLevel > minLevel) minLevel = addedAtGroupLevel;
                    if (this.sameTypeExtraGrouping) {
                        if (item.type === element.type) minLevel = this.groupLevel;
                    }
                }
            }

            this.injectElement(element, minLevel);

            return minLevel === -1 ? element.addedAtLevel : minLevel;
        }

        return element.addedAtLevel;
    }

    protected injectElement(element: ItemElement<T, TYPE>, minLevel: number) {
        const group = this.getFirstGroup(element.type, minLevel);
        if (group) {
            this.addItemAt(group.position + group.length, element.item);
            group.length++;

            // console.log("   ->added into group {$group->type}, position: {$group->position}, level: {$group->level}");

            //increase all following groups +1
            for (const ref of this.groups) {
                if (ref.position > group.position) {
                    ref.position++;
                }
            }
            element.addedAtLevel = group.level;
            this.position++;
        } else {
            this.groups.push({
                type: element.type,
                level: this.groupLevel,
                position: this.position,
                length: 1,
            });
            element.addedAtLevel = this.groupLevel;
            this.sorted.push(element.item);
            this.position++;

            // console.log("   ->just added. New group {$element->id}, position: {$this->position}, level: {$this->groupLevel}");
            this.groupLevel++;
        }
    }

    protected addItemAt(position: number, element: T) {
        this.sorted.splice(position, 0, element);
    }

    protected getFirstGroup(type: TYPE, minLevel: number): Group<TYPE> | undefined {
        let i = this.groupLevel;

        while (i--) {
            const group = this.groups[i];

            if (group.type === type && i >= minLevel) {
                return group;
            }
        }

        return;
    }

    public getGroups() {
        const groups: { type: TYPE, items: T[] }[] = [];

        for (const group of this.groups) {
            groups.push({ type: group.type, items: this.sorted.slice(group.position, group.position + group.length) });
        }

        return groups;
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

    protected doSort() {
        if (this.sorted.length) {
            //reset state when already executed
            for (const element of this.elements.values()) {
                element.visited = false;
            }
        }

        this.sorted = [];
        this.groups = [];
        this.position = 0;
        this.groupLevel = 0;

        for (const element of this.elements.values()) {
            this.visit(element);
        }

        return this.sorted;
    }
}
