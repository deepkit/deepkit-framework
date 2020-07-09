import {BaseImplementation, ElementNotFoundException} from "./base";

interface ItemElement<T> {
    item: T;
    type: string;
    dependencies: T[],
    dependenciesCount: number;
    visited: boolean;
    addedAtLevel: number;
}

interface Group {
    type: string;
    level: number;
    position: number;
    length: number;
}

export class GroupArraySort<T = string> extends BaseImplementation<T> {
    protected elements = new Map<T, ItemElement<T>>();
    protected sorted: T[] = [];
    protected position: number = 0;
    public groups: Group[] = [];
    protected groupLevel: number = 0;

    public sameTypeExtraGrouping: boolean = false;

    set(elements: Map<{ item: T, type: string }, T[]>) {
        for (const [key, deps] of elements.entries()) {
            this.add(key.item, key.type, deps);
        }
    }

    public add(item: T, type: string, dependencies: T[] = []) {
        this.elements.set(item, {
            item, type, dependencies,
            dependenciesCount: dependencies.length,
            visited: false,
            addedAtLevel: -1,
        })
    }

    public visit(element: ItemElement<T>, parents?: Set<T>): number {
        if (parents) this.throwCircularExceptionIfNeeded(element.item, parents);

        if (!element.visited) {
            element.visited = true;

            let minLevel = -1;

            if (element.dependencies.length) {
                parents = parents || new Set<T>();
                parents.add(element.item);

                for (const dependency of element.dependencies) {
                    let item = this.elements.get(dependency);
                    if (!item) throw new ElementNotFoundException(element.item, dependency);

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

    protected injectElement(element: ItemElement<T>, minLevel: number) {
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
            })
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

    protected getFirstGroup(type: string, minLevel: number): Group | undefined {
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
        const groups: { type: string, items: T[] }[] = [];

        for (const group of this.groups) {
            groups.push({type: group.type, items: this.sorted.slice(group.position, group.position + group.length)});
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
