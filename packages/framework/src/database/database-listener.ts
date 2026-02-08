/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { onAppShutdown } from '@deepkit/app';
import { getClassName } from '@deepkit/core';
import { eventDispatcher } from '@deepkit/event';
import { LoggerInterface } from '@deepkit/logger';
import { DatabaseRegistry } from '@deepkit/orm';

import { onServerMainBootstrap } from '../application-server.js';

export class DatabaseListener {
    constructor(
        protected databases: DatabaseRegistry,
        protected logger: LoggerInterface,
    ) {}

    @eventDispatcher.listen(onServerMainBootstrap)
    async onMainBootstrap() {
        for (const databaseType of this.databases.getDatabaseTypes()) {
            if (this.databases.isMigrateOnStartup(databaseType.classType)) {
                const database = this.databases.getDatabase(databaseType.classType);
                if (!database) throw new Error('Database not created');
                this.logger.log(
                    `Migrate database <yellow>${getClassName(database)} ${database.name}</yellow> (${getClassName(database.adapter)})`,
                );
                await database.migrate();
            }
        }
    }

    @eventDispatcher.listen(onAppShutdown)
    onShutdown() {
        this.databases.onShutDown();
    }
}
