import {getClassSchema, getClassTypeFromInstance} from "./decorators";
import {isArray, isObject} from "@marcj/estdlib";

type Mutable<T> = { -readonly [P in keyof T]: Mutable<T[P]> };

/**
 * Shallow clones an object.
 *
 * Supports constructor arguments, but requires to annotate them using @f decorator.
 */
export function shallowCloneClassItem<T extends object>(item: T): T {
    const classType = getClassTypeFromInstance(item);
    const schema = getClassSchema(classType);
    const constructorParameter = schema.getMethodProperties('constructor');
    const args = constructorParameter.map(p => item[p.name]);
    const value = new classType(...args);
    for (const k in item) {
        if (!item.hasOwnProperty(k)) continue;
        value[k] = item[k];
    }
    return value;
}

/**
 * Class to track object changes and patch mechanism to support updating immutable/frozen objects.
 *
 * Use `applyPatch` or `applyAndReturnPatches` for simple use-cases.
 */
export class Patcher<T extends object> {
    /**
     * This is the object with the same shape and origin values as T and SHOULD NOT be changed.
     * Use `proxy` when you want to apply changes.
     */
    public readonly value: T;

    /**
     * By updating certain values on this object, `value` property of this class will be changed accordingly,
     * while only touching and de-referencing the property values that are absolutely necessary.
     */
    public readonly proxy: Mutable<T>;

    /**
     * As soon as you change values in `value`, this patches object fills up.
     *
     * Note: It does not resolve array operations. That means if you have a T shape of
     *     {items: string[]}
     * and change `value.items.push('another')`, then patches contains `{items: ['another]}`.
     */
    public readonly patches: Partial<T> = {};

    protected readonly proxies = new Map<any, any>();

    constructor(public readonly item: T) {
        this.value = shallowCloneClassItem(item);

        this.proxy = this.getProxy('', item, () => {
            return this.value;
        });
    }

    protected getArrayProxy(originalArray: any[], dereferenceArray: () => any[]) {
        let dereferenced: any[] | undefined;
        return new Proxy([], {
            get: (target, prop) => {
                if (prop === 'splice' || prop === 'push' || prop === 'pop' || prop === 'unshift' || prop === 'shift') {
                    if (!dereferenced) dereferenced = dereferenceArray();
                }

                if ('function' === typeof originalArray[prop]) {
                    return originalArray[prop].bind(dereferenced || originalArray);
                }

                return (dereferenced || originalArray)[prop];
            },
            set: (target, prop, value) => {
                if (!dereferenced) dereferenced = dereferenceArray();

                dereferenced[prop] = value;
                return true;
            }
        });
    }

    protected getProxy(incomingPath: string, originalItem: any, dereferenceParent: () => object) {
        let proxy = this.proxies.get(originalItem);
        if (proxy) return proxy;

        const dereferencedObjects = new Map<string | number | symbol, any>();
        const dereferencedArrays = new Map<string | number | symbol, any>();

        const dereferenceObject = (path: string | number | symbol = '') => {
            let ref = dereferencedObjects.get(path);
            if (ref) return ref;

            ref = shallowCloneClassItem(originalItem[path]);
            dereferencedObjects.set(path, ref);
            const parent = dereferenceParent();
            parent[path] = ref;
            return ref;
        }

        const dereferenceArray = (path: string | number | symbol = '') => {
            let ref = dereferencedArrays.get(path);
            if (ref) return ref;

            const fullPath = incomingPath ? incomingPath + '.' + String(path) : String(path);
            ref = originalItem[path].slice(0);
            this.patches[fullPath] = ref;
            dereferencedArrays.set(path, ref);
            const parent = dereferenceParent();
            parent[path] = ref;
            return ref;
        }

        const state = new Map<any, any>();
        let parentDereferenced = false;

        proxy = new Proxy({}, {
            get: (target, prop) => {
                if (state.has(prop)) return state.get(prop);
                const fullPath = incomingPath ? incomingPath + '.' + String(prop) : String(prop);

                if (isObject(originalItem[prop])) {
                    const proxy = this.getProxy(fullPath, originalItem[prop], () => {
                        return dereferenceObject(prop);
                    });
                    state.set(prop, proxy);
                    return proxy;
                }

                if (isArray(originalItem[prop])) {
                    const proxy = this.getArrayProxy(originalItem[prop], () => {
                        return dereferenceArray(prop);
                    });
                    state.set(prop, proxy);
                    return proxy;
                }

                return (dereferencedObjects.get(prop) || originalItem)[prop];
            },
            set: (target, prop, value) => {
                //we dont trigger a change when same value
                // if (!parentDereferenced && value !== undefined && value === originalItem[prop]) return true;
                if (value !== undefined && value === state.get(prop)) return true;

                const fullPath = incomingPath ? incomingPath + '.' + String(prop) : String(prop);

                const ref = dereferenceParent();
                parentDereferenced = true;
                this.patches[fullPath] = value;
                ref[prop] = value;
                state.set(prop, value);
                return true;
            }
        });
        this.proxies.set(originalItem, proxy);

        return proxy;
    }
}

/**
 * This function enables you to track changes made to an object and return only the difference.
 * The difference in the format of a dot-path object allows you to efficiency save or transport changes.
 */
export function applyAndReturnPatches<T extends object>(item: T, patch: (item: Mutable<T>) => void): Partial<T> {
    const patcher = new Patcher(item);
    patch(patcher.proxy);

    return patcher.patches;
}

/**
 * Applies patches to a (readonly) object while not touch the original object
 * and returns the cloned object while keeping unchanged reference intact.
 *
 * Allows to modify a given object partially and keeps references
 * that weren't updated untouched. This is very useful when working
 * with state management systems or dirty checking algorithm.
 *
 * Returns always a new object, but leaves (deep) property references
 * intact when they haven't changed (using the `patcher` modifier).
 *
 * If a deep property has changed (like children.deep.title), then
 * children, and children.deep will have a new reference/instance.
 * `children.another` on other other side is not changed and would not
 * have a new reference.
 *
 * This function is very handy when dealing with state management where
 * you want to make sure that references only change when you really have changed
 * either its value or some (nested) children values. Normally you have to use
 * the spread syntax (...) to quickly create a copy of the state and re-assign
 * only a subset of properties. Like so
 *
 *     return {...state, loggedIn: true};
 *
 * This becomes quickly unused when you have a more complex state. (more complex states
 * are generally not recommended exactly because of that reason)
 * However, patch method enables you to work with unlimited complex stores
 * while having a very easy and convenient way of updating only certain parts of it.
 *
 * When given `item` (or a children object) has constructor arguments,
 * then it's required to annotate them using the @f decorator.
 *
 * It's allowed to pass a freezed (Object.freeze) item (and that's a main purpose of this function).
 *
 * @example
 * ```typescript
 *
 * class Sub {
 *     title: string = '';
 *     sub: Sub = new Sub;
 * }
 *
 * class State {
 *     sub: Sub = new Sub();
 *     otherSub: Sub = new Sub();
 *     title: string = '';
 * }
 *
 * const state = new State;
 * const newState = patchState(state, (state) => {
 *      state.sub.title = 'another-value';
 * });
 * state === newState //false, always the case
 * state.sub === newState.sub //false, because we changed it
 * state.otherSub === newState.otherSub //true, the same since unchanged
 *
 * const newState2 = patchState(state, (state) => {
 *      state.otherSub.sub.title = 'another-value';
 * });
 * state === newState2 //false, always the case
 * state.sub === newState2.sub //true, because we haven't changed it
 * state.otherSub === newState2.otherSub //false, since we deeply changed it
 * ```
 */
export function applyPatch<T extends object>(item: T, patch: (item: Mutable<T>) => void): T {
    const patcher = new Patcher(item);
    patch(patcher.proxy);

    return patcher.value;
}
