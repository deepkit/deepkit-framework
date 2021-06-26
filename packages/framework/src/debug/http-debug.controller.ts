/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { registerStaticHttpController } from '@deepkit/http';
import { AppModule, findParentPath } from '@deepkit/app';

export function registerDebugHttpController(module: AppModule<any, any>, path: string): void {
    const localPath = findParentPath('framework-debug-gui/dist/framework-debug-gui', __dirname);
    if (localPath) {
        registerStaticHttpController(module, path, localPath);
    } else {
        console.log('Warning: framework-debug-gui no build found.');
    }
}
