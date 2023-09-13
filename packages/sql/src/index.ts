/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

export * from './lib/sql-builder.js';
export * from './lib/sql-adapter.js';
export * from './lib/sql-filter-builder.js';

export * from './lib/migration/migration.js';
export * from './lib/migration/migration-provider.js';

export * from './lib/test.js';
export * from './lib/schema/table.js';
export * from './lib/reverse/schema-parser.js';
export * from './lib/platform/default-platform.js';
export * from './lib/serializer/sql-serializer.js';

// FIXME: Cannot find module '@deepkit/sql/commands' or its corresponding type declarations.
export * from './lib/cli/migration-create-command.js';
export * from './lib/cli/migration-down-command.js';
export * from './lib/cli/migration-up-command.js';
export * from './lib/cli/migration-pending-command.js';
export * from './lib/migration/migration-provider.js';

