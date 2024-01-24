/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { pathBasename, pathExtension, pathNormalize } from '@deepkit/core';
import { entity } from '@deepkit/type';

@entity.name('deepkit/debugger/request')
export class DebugRequest {
    ended?: number;
    statusCode?: number;
    logs: number = 0;

    /*
        db time:
            - total
            - query time
        message bus:
            - total time
            - total bytes
            - total latencies
            - messages
                - time
                - bytes
                - latency
        response/request:
            - header
            - body
        events:
            - name
            - time
        template:
            - name
            - time
        logs:
     */

    times: { [name: string]: number } = {};

    constructor(
        public id: number,
        public started: number,
        public method: string,
        public url: string,
        public clientIp: string,
    ) {}

    took(): number {
        return this.ended ? this.ended - this.started : 0;
    }
}

@entity.name('deepkit/debugger/media-file')
export class MediaFile {
    public filesystem: number = 0;
    public size: number = 0;
    public lastModified?: Date;
    public visibility: string = 'unknown';

    // not available in Filesystem
    public created?: Date;
    public mimeType: string = '';

    constructor(
        public path: string,
        public type: string = 'file',
    ) {
        this.path = pathNormalize(path);
    }

    get id(): string {
        return this.path;
    }

    /**
     * Returns true if this file is a symbolic link.
     */
    isFile(): boolean {
        return this.type === 'file';
    }

    /**
     * Returns true if this file is a directory.
     */
    isDirectory(): boolean {
        return this.type === 'directory';
    }

    /**
     * Returns the name (basename) of the file.
     */
    get name(): string {
        return pathBasename(this.path);
    }

    /**
     * Returns true if this file is in the given directory.
     *
     * /folder/file.txt => / => true
     * /folder/file.txt => /folder => true
     * /folder/file.txt => /folder/ => true
     *
     * /folder2/file.txt => /folder/ => false
     * /folder/file.txt => /folder/folder2 => false
     */
    inDirectory(directory: string): boolean {
        directory = pathNormalize(directory);
        if (directory === '/') return true;
        return (this.directory + '/').startsWith(directory + '/');
    }

    /**
     * Returns the directory (dirname) of the file.
     */
    get directory(): string {
        const lastSlash = this.path.lastIndexOf('/');
        return lastSlash <= 0 ? '/' : this.path.slice(0, lastSlash);
    }

    /**
     * Returns the extension of the file, or an empty string if not existing or a directory.
     */
    get extension(): string {
        if (!this.isFile()) return '';
        return pathExtension(this.path);
    }
}
