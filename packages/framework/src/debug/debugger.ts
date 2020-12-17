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

import {LoggerLevel} from '../logger';
import {injectable} from '../injector/injector';
import {Zone} from '../zone';
import {HttpRequest} from '../http-model';
import {DebugRequest} from './models';
import {DebugDatabase} from './db';
import {kernelConfig} from '../kernel.config';
import {openSync, appendFileSync, mkdirSync} from 'fs';
import {dirname, join} from 'path';

export class Debugger {
    protected getCollector(): HttpRequestDebugCollector {
        return Zone.current().collector;
    }

    public log(message: string) {
        this.getCollector()?.log(message);
    }
}

class Config extends kernelConfig.slice(['debugSqlitePath', 'debugStorePath']) {}

@injectable()
export class HttpRequestDebugCollector {
    protected debugRequest?: DebugRequest;
    protected logPath?: string;
    protected logFile?: number;

    constructor(
        protected db: DebugDatabase,
        protected config: Config,
    ) {
    }

    public async init(request: HttpRequest) {
        if (this.debugRequest) throw new Error('DebugCollector already init');
        this.debugRequest = new DebugRequest(
            request.getUrl(), '127.0.0.1'
        );
        await this.db.persist(this.debugRequest);
        this.logPath = join(this.config.debugStorePath, 'requests', this.debugRequest.id + '');
        mkdirSync(this.logPath, {recursive: true});
        this.logFile = openSync(join(this.logPath, 'log.txt'), 'a');
    }

    public log(message: string) {
        if (this.logFile === undefined) return;
        appendFileSync(this.logFile, message);
    }

    async save() {
        const session = this.db.createSession();

        await session.commit();
    }
}
