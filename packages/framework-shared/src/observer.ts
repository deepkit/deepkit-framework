import {ClassSchema, cloneClass, getClassSchema, plainSerializer} from '@deepkit/type';
import {eachPair, getPathValue, size} from '@deepkit/core';
import {compare, Operation} from 'fast-json-patch';
import {set} from 'dot-prop';
import {BehaviorSubject} from 'rxjs';
import {EntitySubject} from './core';

export class ItemObserver<T> extends BehaviorSubject<T | undefined> {
    /**
     * The older snapshot at against we test for changes. reset() resets that.
     */
    protected old?: { [path: string]: any };

    /**
     * The user operates on this object, which is a snapshot of the version upon initialisation.
     */
    protected _snapshot?: T;

    protected valueOrSubject?: T | BehaviorSubject<any>;
    public readonly ignore: string[] = ['version'];

    constructor(value?: T | BehaviorSubject<any>) {
        super(undefined);
        if (value) {
            this.start(value);
        }
    }

    static fromValueOrSubject<T>(valueOrSubject: T | BehaviorSubject<T>, ignore: string[] = []): ItemObserver<T> {
        const observer = new ItemObserver<T>(undefined);
        observer.ignore.push(...ignore);
        observer.start(valueOrSubject);
        return observer;
    }

    /**
     * After creating an ItemObserver, the user requires to operate on this object. Otherwise changes are not detected.
     */
    get snapshot(): T {
        if (!this._snapshot) {
            throw new Error('Observer not started');
        }
        return this._snapshot;
    }

    public start(valueOrSubject: T | BehaviorSubject<T>) {
        if (!valueOrSubject) {
            throw new Error('No value given for observer');
        }

        this.valueOrSubject = valueOrSubject;

        if (this.valueOrSubject instanceof BehaviorSubject) {
            //this should not produce memory leaks, as the EntitySubject should always be unsubscribed when done,
            // so this Subscription will be automatically removed as well.
            this._snapshot = cloneClass(this.valueOrSubject.getValue());

            if (this.valueOrSubject instanceof EntitySubject) {
                this.valueOrSubject.patches.subscribe((patches) => {
                    if (this.valueOrSubject instanceof EntitySubject) {
                        if (this.old) {
                            const plainPatches = plainSerializer.for(Object.getPrototypeOf(this.valueOrSubject.value).constructor).partialSerialize(patches);
                            for (const [i, v] of eachPair(plainPatches)) {
                                set(this.old, i, v);
                            }
                        }

                        for (const [i, v] of eachPair(patches)) {
                            set(this._snapshot as any, i, v);
                        }

                        this.next(this._snapshot);
                    }
                });
            }
        } else {
            this._snapshot = cloneClass(this.valueOrSubject);
        }

        this.old = this.createState();
        this.next(this._snapshot);
    }

    get original(): T | undefined {
        if (this.valueOrSubject) {
            return this.valueOrSubject instanceof EntitySubject ? this.valueOrSubject.getValue() : this.valueOrSubject;
        }
        return;
    }

    createState(): { [path: string]: any } {
        if (this._snapshot && this.original) {
            const item = plainSerializer.for(getClassSchema(this.original) as ClassSchema<T>).serialize(this._snapshot);
            for (const p of this.ignore) {
                delete item[p as keyof T & string];
            }
            return item;
        } else {
            return {};
        }
    }

    changed(): boolean {
        if (this.old) {
            const newState = this.createState();
            const ops = compare(this.old, newState);
            return ops.length !== 0;
        }

        return false;
    }

    /**
     * Returns the plain patch values, key value.
     */
    private normalizePatch(ops: Operation[]): { [path: string]: any } | undefined {
        if (!this._snapshot) return undefined;

        const patches: { [path: string]: any } = {};
        const doc = this._snapshot;

        for (const op of ops) {
            const path = op.path.slice(1).replace(/\//g, '.');
            if (op.op === 'add' || op.op === 'replace') {
                (patches as any)[path] = getPathValue(doc, path);
            } else if (op.op === 'remove') {
                (patches as any)[path] = undefined;
            } else if (op.op === 'move') {
                throw new Error('watch move not implemented');
            } else if (op.op === 'copy') {
                throw new Error('watch copy not implemented');
            } else {
                throw new Error(`watch ${op.op} not implemented`);
            }
        }

        return size(patches) > 0 ? patches : undefined;
    }

    /**
     * Returns class values of patches.
     */
    getPatchesAndReset(): { [name: string]: any } | undefined {
        const patches = this.getPatches();
        if (patches) {
            this.reset();
            return patches;
        }
        return;
    }

    /**
     * Returns plain values of patches.
     */
    getPatches(): { [path: string]: any } | undefined {
        if (this.old) {
            const newState = this.createState();
            const ops = compare(this.old, newState);
            return this.normalizePatch(ops);
        }
        return;
    }

    /**
     * Returns plain values of patches.
     */
    getRawPatches(): { [path: string]: any } | undefined {
        const plainPatches = this.getPatches();
        if (plainPatches) {
            return plainSerializer.for(Object.getPrototypeOf(this._snapshot).constructor).partialSerialize(plainPatches);
        }
        return;
    }

    /**
     * Applies all detected changes to the original object.
     */
    applyAndReset() {
        const object = this.original;
        const patches = this.getPatches();
        if (patches) {
            for (const [i, v] of eachPair(patches)) {
                set(object as any, i, v);
            }
        }

        this.reset();
    }

    /**
     * Resets all changes.
     */
    reset(): void {
        this.old = this.createState();
    }
}

/**
 * Returns patches in plain parameters.
 * @deprecated Use custom patch building.
 */
export function observeItem<T>(valueOrSubject: T | BehaviorSubject<T>, ignore: string[] = ['version']): ItemObserver<T> {
    const observer = new ItemObserver<T>(valueOrSubject);
    return observer;
}
