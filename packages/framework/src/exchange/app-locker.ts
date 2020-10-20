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

import {Exchange, ExchangeLock} from './exchange';
import {injectable} from '../injector/injector';

@injectable()
export class AppLocker {
    constructor(protected exchange: Exchange) {
    }

    /**
     * @param id
     * @param timeout optional defines when the times automatically unlocks.
     */
    public async acquireLock(id: string, timeout?: number): Promise<ExchangeLock> {
        return this.exchange.lock(id, timeout);
    }

    public async isLocked(id: string): Promise<boolean> {
        return this.exchange.isLocked(id);
    }
}
