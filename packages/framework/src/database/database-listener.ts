/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { onServerMainBootstrap, onServerMainShutdown } from '../application-server';
import { eventDispatcher } from '@deepkit/event';
import { injectable } from '@deepkit/injector';
import { Logger } from '@deepkit/logger';
import { DatabaseRegistry } from '@deepkit/orm';

@injectable()
export class DatabaseListener {
    constructor(
        protected databases: DatabaseRegistry,
        protected logger: Logger,
    ) {
    }

    @eventDispatcher.listen(onServerMainBootstrap)
    async onMainBootstrap() {
        for (const databaseType of this.databases.getDatabaseTypes()) {
            if (this.databases.isMigrateOnStartup(databaseType)) {
                const database = this.databases.getDatabase(databaseType);
                if (!database) throw new Error('Database not created');
                this.logger.log(`Migrate database <yellow>${database.name}</yellow>`);
                await database.migrate();
            }
        }
    }

    @eventDispatcher.listen(onServerMainShutdown)
    onShutdown() {
        this.databases.onShutDown();
    }
}
