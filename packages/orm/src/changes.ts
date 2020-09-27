import {empty} from '@deepkit/core';

export type NumberFields<T> = { [K in keyof T]: T[K] extends number | bigint ? K : never }[keyof T]
export type Expression<T> = { [P in keyof T & string]?: string; }
export type Partial<T> = { [P in keyof T & string]?: T[P] }
export type Unset<T> = { [P in keyof T & string]?: 1 | true | 0 | false }

export interface ChangesInterface<T> {
    $set?: Partial<T> | T;
    $unset?: Unset<T>;
    $inc?: Partial<Pick<T, NumberFields<T>>>;
}

export class Changes<T> {
    $set?: Partial<T> | T;
    $unset?: Unset<T>;
    $inc?: Partial<Pick<T, NumberFields<T>>>;

    constructor(
        {$set, $unset, $inc}: ChangesInterface<T> = {}
    ) {
        this.$set = empty($set) ? undefined : $set;
        this.$unset = empty($unset) ? undefined : $unset;
        this.$inc = empty($inc) ? undefined : $inc;
    }

    increase(property: NumberFields<T>, increase: number = 1) {
        if (!this.$inc) this.$inc = {};
        (this.$inc as any)[property] = increase;
    }

    set(property: keyof T & string, value: any) {
        if (!this.$set) this.$set = {};
        (this.$set as any)[property] = value;
    }

    unset(property: keyof T & string, unset = true) {
        if (!this.$unset) this.$unset = {};
        (this.$unset as any)[property] = unset;
    }
}

export class ItemChanges<T> extends Changes<T> {
    constructor(
        changes: ChangesInterface<T> = {},
        protected item: T
    ) {
        super(changes);
    }

    increase(property: NumberFields<T>, increase: number = 1) {
        super.increase(property, increase);
        (this.item as any)[property] += increase;
    }

    set(property: keyof T & string, value: any) {
        super.set(property, value);
        (this.item as any)[property] = value;
    }

    unset(property: keyof T & string, unset: boolean = true) {
        super.unset(property, unset);
        (this.item as any)[property] = undefined;
    }
}


export const changeSetSymbol = Symbol('changeSet');

export class AtomicChangeInstance<T> {
    public readonly changeSet: Changes<T> = new Changes<T>();

    constructor(protected object: any) {
        this.changeSet.$inc = {};
        (object as any)[changeSetSymbol] = this.changeSet;
    }

    increase(property: NumberFields<T>, increase: number = 1) {
        this.object[property] += increase;
        (this.changeSet.$inc as any)[property] = increase as any;
    }
}

export function atomicChange<T>(object: T) {
    return new AtomicChangeInstance<T>(object);
}
