/**
 * for (const i of eachKey(['a', 'b']) {
 *    console.log(i); //0, 1
 * }
 */
export function eachKey<T>(object: ArrayLike<T>): IterableIterator<number>;
export function eachKey<T extends {[key: string]: any}, K extends keyof T>(object: T): IterableIterator<string>;
export function *eachKey<T extends {[key: string]: any}, K extends keyof T>(object: T | ArrayLike<T>): IterableIterator<string | number> {
    if (Array.isArray(object)) {
        for (let i = 0; i < object.length; i++) {
            yield i;
        }
    } else {
        for (const i in object) {
            if (object.hasOwnProperty(i)) {
                yield i as string;
            }
        }
    }
}

/**
 * for (const v of each(['a', 'b']) {
 *    console.log(v); //a, b
 * }
 */
export function *each<T>(object: {[s: string]: T} | ArrayLike<T>): IterableIterator<T> {
    if (Array.isArray(object)) {
        for (let i = 0; i <= object.length; i++) {
            yield object[i];
        }
    } else {
        for (const i in object) {
            if (object.hasOwnProperty(i)) {
                yield (object as {[s: string]: T})[i];
            }
        }
    }
}

/**
 *
 * for (const [i, v] of eachPair(['a', 'b']) {
 *    console.log(i, v); //0 a, 1 b
 * }
 *
 * for (const [i, v] of eachPair({'foo': 'bar}) {
 *    console.log(i, v); //foo bar
 * }
 */
export function eachPair<T>(object: ArrayLike<T>): IterableIterator<[number, T]>;
export function eachPair<T>(object: { [s: string]: T }): IterableIterator<[string, T]>;
export function *eachPair<T>(object: { [s: string]: T } |  ArrayLike<T>): IterableIterator<[string, T] | [number, T]> {
    if (Array.isArray(object)) {
        for (let i = 0; i < object.length; i++) {
            yield [i, object[i]];
        }
    } else {
        for (const i in object) {
            if (object.hasOwnProperty(i)) {
                yield [i, (object as {[s: string]: T})[i]];
            }
        }
    }
}
