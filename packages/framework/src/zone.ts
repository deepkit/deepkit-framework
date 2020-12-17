/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import {AsyncLocalStorage} from 'async_hooks';

type SimpleStore = { [name: string]: any };

export class Zone {
    static asyncLocalStorage?: any;

    static enable() {
        this.asyncLocalStorage = new AsyncLocalStorage<any>();
        this.asyncLocalStorage.enterWith({});
    }

    static current(): SimpleStore {
        return Zone.asyncLocalStorage?.getStore();
    }

    static run<T>(data: SimpleStore, cb: () => T): T {
        if (!Zone.asyncLocalStorage) return cb();
        return Zone.asyncLocalStorage.run(data, cb);
    }
}
