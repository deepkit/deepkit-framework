/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { AsyncLocalStorage } from 'async_hooks';

type SimpleStore = { [name: string]: any };

export class Zone {
    static asyncLocalStorage?: AsyncLocalStorage<any>;

    static enable() {
        this.asyncLocalStorage = new AsyncLocalStorage<any>();
        this.asyncLocalStorage.enterWith({});
    }

    static current(): SimpleStore {
        return Zone.asyncLocalStorage?.getStore() || {};
    }

    static run<T>(data: SimpleStore, cb: () => T): T {
        if (!Zone.asyncLocalStorage) return cb();
        return Zone.asyncLocalStorage.run(data, cb);
    }
}
