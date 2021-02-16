/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { join } from 'path';
import { registerStaticHttpController } from '@deepkit/http';
import { AppModule } from '@deepkit/app';

export function registerDebugHttpController(module: AppModule<any, any>, path: string): void {
    const localPathPrefix = __dirname.includes('framework/dist') ? '../../../../' : '../../../';
    const localPath = join(__dirname, localPathPrefix, 'node_modules/@deepkit/framework-debug-gui/dist/framework-debug-gui');
    registerStaticHttpController(module, path, localPath);
}
