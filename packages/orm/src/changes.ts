export type NumberFields<T> = { [K in keyof T]: T[K] extends number | bigint ? K : never }[keyof T]
export type Expression<T> = { [P in keyof T & string]?: string; }
export type Partial<T> = { [P in keyof T & string]?: T[P] }
export type Unset<T> = { [P in keyof T & string]?: 1 | true | 0 | false }

export type Changes<T> = {
    $set?: Partial<T> | T,
    $unset?: Unset<T>,
    $inc?: Partial<Pick<T, NumberFields<T>>>,
}

export type Patch<T> = Partial<T>
    & { [P in keyof T & string]?: { $inc: number } }
    & { [P in keyof T & string]?: { $unset: 1 | true | 0 | false } }

    & { [P in keyof T & string]?: { $pop: number } }
    & { [P in keyof T & string]?: { $push: T[P] } }
    & { [P in keyof T & string]?: { $remove: T[P] } }
    ;

export const changeSetSymbol = Symbol('changeSet');

export class AtomicChangeInstance<T> {
    public readonly changeSet: Changes<T> = {};

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
