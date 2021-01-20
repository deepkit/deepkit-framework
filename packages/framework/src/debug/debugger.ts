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

import { DebugRequest } from '@deepkit/framework-debug-shared';
import { DatabaseAdapter, DatabaseSession } from '@deepkit/orm';
import { appendFileSync, mkdirSync, openSync } from 'fs';
import { join } from 'path';
import { HttpRequest, HttpResponse } from '../http-model';
import { injectable } from '../injector/injector';
import { kernelConfig } from '../kernel.config';
import { normalizeDirectory } from '../utils';
import { Zone } from '../zone';
import { DebugDatabase } from './db';
import { Stopwatch } from './stopwatch';

export class Debugger {
    protected getCollector(): HttpRequestDebugCollector | undefined {
        return Zone.current().collector;
    }

    public log(message: string, level: number) {
        this.getCollector()?.log(message, level);
    }

    get stopwatch(): Stopwatch | undefined {
        return this.getCollector()?.stopwatch;
    }
}

class Config extends kernelConfig.slice(['varPath', 'debugSqlitePath', 'debugStorePath', 'debugUrl']) { }

@injectable()
export class HttpRequestDebugCollector {
    protected debugRequest?: DebugRequest;
    protected logPath?: string;
    protected logFile?: number;
    protected session: DatabaseSession<DatabaseAdapter>;
    protected logs: number = 0;
    public stopwatch = new Stopwatch;

    constructor(
        protected db: DebugDatabase,
        protected config: Config,
        protected request: HttpRequest,
        protected response: HttpResponse,
    ) {
        this.session = this.db.createSession();
    }

    public async init() {
        if (this.request.getUrl().startsWith(normalizeDirectory(this.config.debugUrl))) return;

        this.debugRequest = new DebugRequest(
            this.request.getMethod(), this.request.getUrl(), '127.0.0.1'
        );
        this.session.add(this.debugRequest);
        await this.session.commit();
        this.logPath = join(this.config.varPath, this.config.debugStorePath, 'requests', this.debugRequest.id + '');
        mkdirSync(this.logPath, { recursive: true });
        this.logFile = openSync(join(this.logPath, 'log.txt'), 'a');
    }

    public log(message: string, level: number) {
        if (this.logFile === undefined) return;
        this.logs++;
        appendFileSync(this.logFile, message);
    }

    async save() {
        if (!this.debugRequest) return;

        this.debugRequest!.times = this.stopwatch.getTimes();
        this.debugRequest!.statusCode = this.response.statusCode;
        await this.session.commit();
    }
}
