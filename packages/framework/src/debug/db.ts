/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { DebugRequest } from '@deepkit/framework-debug-api';
import { Database } from '@deepkit/orm';
import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';
import { dirname, join } from 'path';
import { inject } from '../injector/injector';
import { kernelConfig } from '../kernel.config';
import fsExtra from 'fs-extra';

const { ensureDirSync } = fsExtra;

export class DebugDatabase extends Database {
    constructor(
        @inject(kernelConfig.token('varPath')) varPath: string,
        @inject(kernelConfig.token('debugSqlitePath')) debugSqlitePath: string,
    ) {
        const dir = dirname(join(varPath, debugSqlitePath));
        ensureDirSync(dir);
        super(new SQLiteDatabaseAdapter(join(varPath, debugSqlitePath)), [
            DebugRequest,
        ]);
        this.name = 'debug';
    }
}
