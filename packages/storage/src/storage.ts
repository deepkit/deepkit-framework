import { asyncOperation } from '@deepkit/core';
import { normalizePath } from 'typedoc';

export enum FileType {
    File,
    Directory,
    SymbolicLink,
    Unknown,
}

/**
 * Represents a file or directory in the storage system.
 */
export class StorageFile {
    public size?: number;
    public type: FileType = FileType.File;
    public lastModified?: Date;

    constructor(public path: string) {
        this.path = pathNormalize(path);
    }

    /**
     * Returns true if this file is a symbolic link.
     */
    isFile(): boolean {
        return this.type === FileType.File;
    }

    /**
     * Returns true if this file is a directory.
     */
    isDirectory(): boolean {
        return this.type === FileType.Directory;
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
        const lastDot = this.path.lastIndexOf('.');
        return lastDot === -1 ? '' : this.path.slice(lastDot + 1);
    }
}

export interface Operation<T> extends Promise<T> {
    /**
     * Adds a callback that is called when the progress changes.
     * Filesystem adapters might report progress on some operations,
     * like read/write content, read folder, copy, move, etc.
     *
     * The unit of loaded and total is not defined and depends on the adapter.
     * It might be bytes or the amount of files. if total=0, the total is unknown.
     */
    onProgress(callback: (loaded: number, total: number) => void): this;

    /**
     * When called the filesystem adapter tries to abort the operation.
     * This is not guaranteed to work, as some adapters might not support it.
     * When aborted, the promise will be rejected with an StorageOperationAborted error.
     */
    abort(): Promise<void>;

    /**
     * Returns true if the operation was aborted.
     */
    aborted: boolean;
}

export interface StorageAdapter {
    /**
     * Returns all files directly in the given folder.
     */
    files(path: string, reporter: Reporter): Promise<StorageFile[]>;

    /**
     * Returns all files in the given folder and all subfolders.
     */
    allFiles(path: string, reporter: Reporter): Promise<StorageFile[]>;

    /**
     * Returns all directories directly in the given folder.
     */
    directories?(path: string, reporter: Reporter): Promise<StorageFile[]>;

    /**
     * Returns all directories in the given folder and all subfolders.
     */
    allDirectories?(path: string, reporter: Reporter): Promise<StorageFile[]>;

    /**
     * Creates a new directory and all parent directories if not existing.
     * Does nothing if the directory already exists.
     */
    makeDirectory(path: string): Promise<void>;

    /**
     * Writes the given contents to the given path.
     * Ensures that all parent directories exist.
     */
    write(path: string, contents: Uint8Array, reporter: Reporter): Promise<void>;

    /**
     * Reads the contents of the given path.
     * @throws Error if the file does not exist.
     */
    read(path: string, reporter: Reporter): Promise<Uint8Array>;

    /**
     * Returns the file at the given path or undefined if not existing.
     */
    get(path: string): Promise<StorageFile | undefined>;

    /**
     * Returns true if the file exists.
     */
    exists(path: string): Promise<boolean>;

    /**
     * Deletes the file at the given path.
     * Does nothing if the file does not exist.
     */
    delete(path: string): Promise<void>;

    /**
     * Deletes the directory at the given path and all files and directories in it recursively.
     * Does nothing if the directory does not exist.
     */
    deleteDirectory(path: string, reporter: Reporter): Promise<void>;

    /**
     * Copies the file from source to destination.
     * Ensures that all parent directories exist.
     * If source is a directory, it copies the directory recursively.
     */
    copy(source: string, destination: string, reporter: Reporter): Promise<void>;

    /**
     * Moves the file from source to destination.
     * Ensures that all parent directories exist.
     * If source is a directory, it moves the directory recursively.
     */
    move(source: string, destination: string, reporter: Reporter): Promise<void>;
}

/**
 * Generic StorageError. Base of all errors thrown by the Storage system.
 */
export class StorageError extends Error {
}

/**
 * Thrown when a file or directory does not exist.
 */
export class StorageFileNotFound extends StorageError {
}

/**
 * Thrown when an operation is aborted.
 */
export class StorageOperationAborted extends StorageError {
}

export type Reporter = { progress: (loaded: number, total: number) => void, onAbort: () => Promise<void>, aborted: boolean };

export function createProgress<T>(callback: (reporter: Reporter) => Promise<T>): Operation<T> {
    const callbacks: ((loaded: number, total: number) => void)[] = [];

    const reporter = {
        progress: (loaded: number, total: number) => {
            for (const callback of callbacks) callback(loaded, total);
        },
        onAbort: () => Promise.resolve(),
        aborted: false,
    };

    let reject: (error: Error) => void;
    const promise = asyncOperation<T>(async (resolve, _reject) => {
        reject = _reject;
        resolve(await callback(reporter));
    }) as Operation<T>;

    promise.onProgress = (callback: (loaded: number, total: number) => void) => {
        callbacks.push(callback);
        return promise;
    };

    promise.aborted = false;
    promise.abort = async () => {
        reporter.aborted = true;
        await reporter.onAbort();
        promise.aborted = true;
        reject(new StorageOperationAborted('Operation aborted'));
    };

    return promise;
}

export class Storage {
    constructor(public adapter: StorageAdapter) {
    }

    protected normalizePath(path: string): string {
        return pathNormalize(path);
    }

    /**
     * Returns all files directly in the given folder.
     *
     * Returns a Progress object that can be used to track the progress of the operation.
     */
    files(path: string): Operation<StorageFile[]> {
        path = this.normalizePath(path);
        return createProgress<StorageFile[]>(async (reporter) => {
            const files = await this.adapter.files(path, reporter);
            files.sort(compareFileSorting);
            return files;
        });
    }

    /**
     * Returns all files paths in the given folder.
     *
     * Returns a Progress object that can be used to track the progress of the operation.
     */
    fileNames(path: string): Operation<string[]> {
        path = this.normalizePath(path);
        return createProgress<string[]>(async (reporter) => {
            //todo: some adapters might be able to do this more efficiently
            const files = await this.adapter.files(path, reporter);
            files.sort(compareFileSorting);
            return files.map(v => v.path);
        });
    }

    /**
     * Returns all files in the given folder and all subfolders.
     *
     * Returns a Progress object that can be used to track the progress of the operation.
     */
    allFiles(path: string): Operation<StorageFile[]> {
        path = this.normalizePath(path);
        return createProgress<StorageFile[]>(async (reporter) => {
            const files = await this.adapter.allFiles(path, reporter);
            files.sort(compareFileSorting);
            return files;
        });
    }

    /**
     * Returns all files paths in the given folder and all subfolders.
     *
     * Returns a Progress object that can be used to track the progress of the operation.
     */
    allFileNames(path: string): Operation<string[]> {
        path = this.normalizePath(path);
        return createProgress<string[]>(async (reporter) => {
            //todo: some adapters might be able to do this more efficiently
            const files = await this.adapter.allFiles(path, reporter);
            files.sort(compareFileSorting);
            return files.map(v => v.path);
        });
    }

    /**
     * Returns all directories directly in the given folder.
     *
     * Returns a Progress object that can be used to track the progress of the operation.
     */
    directories(path: string): Operation<StorageFile[]> {
        path = this.normalizePath(path);
        return createProgress<StorageFile[]>(async (reporter) => {
            if (this.adapter.directories) {
                return await this.adapter.directories(path, reporter);
            } else {
                const files = await this.adapter.files(path, reporter);
                return files.filter(v => v.isDirectory());
            }
        });
    }

    /**
     * Returns all directories in the given folder and all subfolders.
     *
     * Returns a Progress object that can be used to track the progress of the operation.
     */
    allDirectories(path: string): Operation<StorageFile[]> {
        path = this.normalizePath(path);
        return createProgress<StorageFile[]>(async (reporter) => {
            if (this.adapter.allDirectories) {
                return await this.adapter.allDirectories(path, reporter);
            } else {
                const files = await this.adapter.allFiles(path, reporter);
                return files.filter(v => v.isDirectory());
            }
        });
    }

    /**
     * Writes the given content to the given path.
     * Ensures that all parent directories exist.
     * Overwrites if already existing.
     *
     * Returns a Progress object that can be used to track the progress of the operation.
     */
    write(path: string, content: Uint8Array | string): Operation<void> {
        path = this.normalizePath(path);
        const buffer = typeof content === 'string' ? new TextEncoder().encode(content) : content;
        return createProgress<void>(async (reporter) => {
            return await this.adapter.write(path, buffer, reporter);
        });
    }

    /**
     * Reads the contents of the given path as binary.
     *
     * Returns a Progress object that can be used to track the progress of the operation.
     */
    read(path: string): Operation<Uint8Array> {
        path = this.normalizePath(path);
        return createProgress<Uint8Array>(async (reporter) => {
            return await this.adapter.read(path, reporter);
        });
    }

    /**
     * Reads the contents of the given path as string.
     *
     * Returns a Progress object that can be used to track the progress of the operation.
     */
    readAsText(path: string): Operation<string> {
        path = this.normalizePath(path);
        return createProgress<string>(async (reporter) => {
            const contents = await this.adapter.read(path, reporter);
            return new TextDecoder().decode(contents);
        });
    }

    /**
     * Returns the file at the given path.
     *
     * @throws StorageFileNotFound if the file does not exist.
     */
    async get(path: string): Promise<StorageFile> {
        path = this.normalizePath(path);
        const file = await this.adapter.get(path);
        if (!file) throw new StorageFileNotFound('File not found');
        return file;
    }

    /**
     * Returns the file at the given path or undefined if not existing.
     */
    getOrUndefined(path: string): Promise<StorageFile | undefined> {
        path = this.normalizePath(path);
        return this.adapter.get(path);
    }

    /**
     * Returns true if the file exists.
     */
    exists(path: string): Promise<boolean> {
        path = this.normalizePath(path);
        return this.adapter.exists(path);
    }

    /**
     * Deletes the file at the given path.
     * Does nothing if the file does not exist.
     */
    delete(path: string): Promise<void> {
        path = this.normalizePath(path);
        return this.adapter.delete(path);
    }

    /**
     * Deletes the directory at the given path and all files and directories in it recursively.
     */
    deleteDirectory(path: string): Operation<void> {
        path = this.normalizePath(path);
        return createProgress<void>(async (reporter) => {
            return this.adapter.deleteDirectory(path, reporter);
        });
    }

    /**
     * Copies the file or directory from source to destination, recursively.
     */
    copy(source: string, destination: string): Operation<void> {
        source = this.normalizePath(source);
        destination = this.normalizePath(destination);
        return createProgress<void>(async (reporter) => {
            return this.adapter.copy(source, destination, reporter);
        });
    }

    /**
     * Moves the file or directory from source to destination, recursively.
     */
    move(source: string, destination: string): Operation<void> {
        source = this.normalizePath(source);
        destination = this.normalizePath(destination);
        return createProgress<void>(async (reporter) => {
            return this.adapter.move(source, destination, reporter);
        });
    }

    /**
     * Creates a new directory, and all parent directories if not existing.
     */
    makeDirectory(path: string): Promise<void> {
        path = this.normalizePath(path);
        return this.adapter.makeDirectory(path);
    }
}

/**
 * Normalizes the given path.
 * Removes duplicate slashes, removes trailing slashes, adds a leading slash.
 */
export function pathNormalize(path: string): string {
    path = path[0] !== '/' ? '/' + path : path;
    path = path.length > 1 && path[path.length - 1] === '/' ? path.slice(0, -1) : path;
    return path.replace(/\/+/g, '/');
}

/**
 * Returns the directory (dirname) of the given path.
 */
export function pathDirectory(path: string): string {
    if (path === '/') return '/';
    const lastSlash = path.lastIndexOf('/');
    return lastSlash === -1 ? '' : path.slice(0, lastSlash);
}

/**
 * Returns the basename of the given path.
 */
export function pathBasename(path: string): string {
    const lastSlash = path.lastIndexOf('/');
    return lastSlash === -1 ? path : path.slice(lastSlash + 1);
}

/**
 * A sorting comparator for StorageFile that sorts directories first, then by path.
 */
export function compareFileSorting(a: StorageFile, b: StorageFile): number {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.path.localeCompare(b.path);
}

export function pathDirectories(path: string): string [] {
    path = normalizePath(path);
    if (path === '/') return [];
    const directories: string[] = [];
    for (const part of path.split('/')) {
        if (!part) continue;
        if (directories.length === 0) {
            directories.push('/' + part);
        } else {
            directories.push(directories[directories.length - 1] + '/' + part);
        }
    }
    return directories;
}
