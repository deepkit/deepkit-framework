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
import { AppModule } from '@deepkit/app';
import { resolve } from './resolve.js';

export function registerDebugHttpController(module: AppModule<any>, path: string): void {
    const localPath = (() => {
        try {
            return resolve('@deepkit/framework-debug-gui/dist/framework-debug-gui/index.html')
        } catch (e) {
            console.log('Warning: @deepkit/framework-debug-gui assets location not resolved.')
            return null
        }
    })()
    if (!localPath) return

    registerStaticHttpController(module, { path, localPath, groups: ['app-static'], controllerName: 'FrameworkDebuggerController' });
}
