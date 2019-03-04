import {getClassName} from "./core";

function initializeProperty(target: any, name: string): { [k: string]: any } {
    if (target[name]) {
        return target[name];
    }

    const value: { [k: string]: any } = {};
    Object.defineProperty(target, name, {
        enumerable: false,
        configurable: false,
        value: value,
    });

    return value;
}

/**
 * Logs every call to this method on stdout.
 *
 * @public
 */
export function log() {
    return function (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
        const orig = descriptor.value;
        descriptor.value = function (...args: any[]) {
            const a = args.map(v => typeof v).join(',');
            console.info(getClassName(target) + '::' + String(propertyKey) + '(' + a + ')');
            return orig.apply(this, args);
        };

        return descriptor;
    };
}

/**
 * Makes sure that calls to this async method are stacked up and are called one after another and not parallel.
 *
 * @public
 */
export function stack() {
    return function (target: object, propertyKey: string, descriptor: TypedPropertyDescriptor<(...args: any[]) => Promise<any>>) {
        const orig = descriptor.value;

        // console.log('sync patch', propertyKey, constructor.prototype[propertyKey]);
        descriptor.value = async function (...args: any[]) {
            const calls = initializeProperty(this, '__stack_calls');

            while (calls[propertyKey]) {
                await calls[propertyKey];
            }

            calls[propertyKey] = (orig as any).apply(this, args);

            try {
                await calls[propertyKey];
            } finally {
                delete calls[propertyKey];
            }

            return calls[propertyKey];
        };
    };
}

/**
 * Makes sure that this async method is only running once at a time. When this method is running and it is tried
 * to call it another times, that call is dropped and returns simply the result of the previous running call.
 *
 * @public
 */
export function singleStack() {
    return function (target: object, propertyKey: string, descriptor: TypedPropertyDescriptor<(...args: any[]) => Promise<any>>) {
        const orig = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            const calls = initializeProperty(this, '__sync_calls');

            if (calls[propertyKey]) {
                return await calls[propertyKey];
            }

            calls[propertyKey] = (orig as any).apply(this, args);

            try {
                await calls[propertyKey];
            } finally {
                delete calls[propertyKey];
            }

            return calls[propertyKey];
        };
    };
}
