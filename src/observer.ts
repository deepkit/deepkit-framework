import {EntitySubject} from "./core";
import {classToPlain, partialClassToPlain} from "@marcj/marshal";
import {eachPair, getPathValue, size} from "@marcj/estdlib";
import {compare, Operation} from 'fast-json-patch';
import {set} from 'dot-prop';

export class ItemObserver<T> {
    protected old: { [path: string]: any };

    constructor(
        private valueOrSubject: T | EntitySubject<any>,
        private ignore: string[] = ['version']
    ) {

        if (this.valueOrSubject instanceof EntitySubject) {
            //this should not produce memory leaks, as the EntitySubject should always be unsubscribed when done,
            // so this Subscription will be automatically removed as well.
            this.valueOrSubject.patches.subscribe((patches) => {
                if (!this.old) return;

                if (this.valueOrSubject instanceof EntitySubject) {
                    const plainPatches = partialClassToPlain(Object.getPrototypeOf(this.valueOrSubject.value).constructor, patches);
                    for (const [i, v] of eachPair(plainPatches)) {
                        set(this.old, i, v);
                    }
                }
            });
        }

        this.old = this.createState();
    }

    createState(): { [path: string]: any } {
        if (this.valueOrSubject instanceof EntitySubject) {
            if (this.valueOrSubject.value) {
                const item = classToPlain(Object.getPrototypeOf(this.valueOrSubject.value).constructor, this.valueOrSubject.value);
                for (const p of this.ignore) {
                    delete item[p];
                }
                return item;
            } else {
                return {};
            }
        } else {
            if (this.valueOrSubject) {
                const item = classToPlain(Object.getPrototypeOf(this.valueOrSubject).constructor, this.valueOrSubject);
                for (const p of this.ignore) {
                    delete item[p];
                }
                return item;
            } else {
                return {};
            }
        }
    }

    changed(): boolean {
        const newState = this.createState();
        const ops = compare(this.old, newState);
        return ops.length !== 0;
    }

    private normalizePatch(ops: Operation[]): { [path: string]: any } | undefined {
        const patches: { [path: string]: any } = {};
        const doc = this.valueOrSubject instanceof EntitySubject ? this.valueOrSubject.value : this.valueOrSubject;

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

    getPatchesAndReset(): { [path: string]: any } | undefined {
        const newState = this.createState();
        const ops = compare(this.old, newState);
        this.old = newState;

        return this.normalizePatch(ops);
    }

    getPatches(): { [path: string]: any } | undefined {
        const newState = this.createState();
        const ops = compare(this.old, newState);
        return this.normalizePatch(ops);
    }

    reset(): void {
        this.old = this.createState();
    }
}

/**
 * Returns patches in plain parameters.
 */
export function observeItem<T>(valueOrSubject: T | EntitySubject<any>, ignore: string[] = ['version']): ItemObserver<T> {
    return new ItemObserver(valueOrSubject, ignore);
}
