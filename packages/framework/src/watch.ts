/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { EventEmitter } from 'events';

class ImportedFiles extends EventEmitter {
    files: string[] = [];

    on(event: 'file', listener: (...args: any[]) => void): this {
        return super.on(event, listener);
    }

    add(path: string) {
        this.files.push(path);
        this.emit('file');
    }
}

export const importedFiles = new ImportedFiles();

/**
 * Watch files in importedFiles and trigger the callback when change detected
 */
export function watch(callback: () => void) {
    //todo: Watch for changes and callback when detected.
    // make sure that files added after this watch function has been called are handled as well
    importedFiles.on('file', () => {

    });
}
