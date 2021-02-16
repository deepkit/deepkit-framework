/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { t } from '@deepkit/type';
import { AppModuleConfig } from '@deepkit/app';

export const brokerConfig = new AppModuleConfig({
    listen: t.string.default('localhost:8811').description('Unix socket path or host:port combination'),
    host: t.string.default('localhost:8811').description('Unix socket path or host:port combination'),
    startOnBootstrap: t.boolean.default(true).description('Automatically starts a single broker for all workers. Disable it if you have a custom broker node.'),
});
