/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG
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
