const myGlobal = new Map()


function getGlobal(): Map<any, any> {
    if ('undefined' !== typeof window) {
        if (!(window as any)['__deepkit_type']) (window as any)['__deepkit_type'] = new Map();

        return (window as any)['__deepkit_type'];
    }
    if ('undefined' !== typeof globalThis) {
        if (!(globalThis as any)['__deepkit_type']) (globalThis as any)['__deepkit_type'] = new Map();

        return (globalThis as any)['__deepkit_type'];
    }
    return myGlobal;
}

function getStore(target: object, propertyKey: string | symbol | undefined, createWhenUnavailable: false): Map<string, any> | undefined;
function getStore(target: object, propertyKey: string | symbol | undefined, createWhenUnavailable?: true): Map<string, any>;
function getStore(target: object, propertyKey: string | symbol | undefined, createWhenUnavailable: boolean = true): Map<string, any> | undefined {
    const global = getGlobal();

    if (propertyKey) {
        let storeWrapper = global.get(target);
        if (!storeWrapper) {
            if (!createWhenUnavailable) return;
            storeWrapper = new Map<string | symbol, any>();
            global.set(target, storeWrapper);
        }

        let store = storeWrapper.get(propertyKey) as Map<string, any>;
        if (!store) {
            if (!createWhenUnavailable) return;
            store = new Map<string, any>();
            storeWrapper.set(propertyKey, store);
        }
        return store;
    }

    let store = global.get(target) as Map<string, any>;
    if (!store) {
        if (!createWhenUnavailable) return;
        store = new Map<string, any>();
        global.set(target, store);
    }
    return store;
}

export function storeMetaData(key: string, value: any, target: object, propertyKey?: string | symbol) {
    getStore(target, propertyKey).set(key, value);
}

export function retrieveMetaData<T = any>(key: string, target: object, propertyKey?: string | symbol): T | undefined {
    const store = getStore(target, propertyKey, false);
    if (store) {
        return store.get(key);
    }
    return;
}
