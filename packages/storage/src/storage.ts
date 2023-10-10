import { asyncOperation } from '@deepkit/core';
import { readFile } from 'fs/promises';

export enum FileType {
    File,
    Directory,
    SymbolicLink,
    Unknown,
}

/**
 * Settings for file and directory permissions.
 */
export type FileVisibility = 'public' | 'private';

/**
 * Represents a file or directory in the storage system.
 */
export class StorageFile {
    public size: number = 0;
    public lastModified?: Date;

    /**
     * Visibility of the file.
     *
     * Note that some adapters might not support reading the visibility of a file.
     * In this case, the visibility is always 'private'.
     *
     * Some adapters might support reading the visibility per file, but not when listing files.
     * In this case you have to call additional `storage.get(file)` to load the visibility.
     */
    public visibility: FileVisibility = 'public';

    constructor(
        public path: string,
        public type: FileType = FileType.File,
    ) {
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
    supportsVisibility(): boolean;
    supportsDirectory(): boolean;

    setVisibility?(path: string, visibility: FileVisibility): Promise<void>;

    /**
     * Closes the adapter (close connections, etc).
     */
    close?(): Promise<void>;

    /**
     * Returns all files (and directories) directly in the given folder.
     */
    files(path: string, reporter: Reporter): Promise<StorageFile[]>;

    /**
     * Returns all files (and directories) in the given folder and all sub folders.
     *
     * If the adapter does not support this, it will be emulated by calling files() recursively.
     */
    allFiles?(path: string, reporter: Reporter): Promise<StorageFile[]>;

    /**
     * Returns all directories directly in the given folder.
     */
    directories?(path: string, reporter: Reporter): Promise<StorageFile[]>;

    /**
     * Returns all directories in the given folder and all sub folders.
     *
     * If the adapter does not support this, it will be emulated by calling directories() recursively.
     */
    allDirectories?(path: string, reporter: Reporter): Promise<StorageFile[]>;

    /**
     * Creates a new directory and all parent directories if not existing.
     * Does nothing if the directory already exists.
     */
    makeDirectory(path: string, visibility: FileVisibility): Promise<void>;

    /**
     * Returns the public URL for the given path.
     *
     * For local storage it's the configured base URL + the path.
     * For adapters like S3 it's the public S3 URL to the file.
     */
    publicUrl?(path: string): Promise<string>;

    /**
     * Writes the given contents to the given path.
     * Ensures that all parent directories exist.
     */
    write(path: string, contents: Uint8Array, visibility: FileVisibility, reporter: Reporter): Promise<void>;

    /**
     * Appends the given contents to the given file.
     *
     *
     * Optional. If not implemented, the file will be read into memory, content appended, and then written.
     */
    append?(path: string, contents: Uint8Array, reporter: Reporter): Promise<void>;

    /**
     * Prepends the given contents to the given file.
     *
     * Optional. If not implemented, the file will be read into memory, content prepended, and then written.
     */
    prepend?(path: string, contents: Uint8Array, reporter: Reporter): Promise<void>;

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
     * Returns true if all the given paths exist.
     */
    exists(path: string[]): Promise<boolean>;

    /**
     * Deletes all the given paths.
     * Does nothing if one file does not exist.
     */
    delete(path: string[]): Promise<void>;

    /**
     * Deletes the directory at the given path and all files and directories in it recursively.
     * Does nothing if the directory does not exist.
     */
    deleteDirectory(path: string, reporter: Reporter): Promise<void>;

    /**
     * Copies the file from source to destination.
     * Ensures that all parent directories exist.
     * If source is a directory, it copies the directory recursively.
     *
     * If the adapter does not support copying, we emulate it by doing it manually.
     */
    copy?(source: string, destination: string, reporter: Reporter): Promise<void>;

    /**
     * Moves the file from source to destination.
     * Ensures that all parent directories exist.
     * If source is a directory, it moves the directory recursively.
     *
     * If the adapter does not support moving, we emulate it by doing it manually. read, write, then delete.
     */
    move?(source: string, destination: string, reporter: Reporter): Promise<void>;
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

export type StoragePath = string | StorageFile | string[];

export function resolveStoragePath(path: StoragePath): string {
    if (typeof path === 'string') return pathNormalize(path);
    if (Array.isArray(path)) {
        return '/' + path
            .map(v => pathNormalize(v).slice(1))
            .filter(v => !!v)
            .join('/');
    }
    return path.path;
}

export function pathJoin(...paths: string[]): string {
    return '/' + paths
        .map(v => pathNormalize(v).slice(1))
        .filter(v => !!v)
        .join('/');
}

export interface StorageOptions {
    /**
     * Default visibility for new files.
     */
    visibility: FileVisibility;

    /**
     * Default visibility for new directories.
     */
    directoryVisibility: FileVisibility;

    /**
     * Transforms a given path to a cleaned path (e.g. remove not allowed characters, remove whitespaces, etc).
     * Per default replaces all not allowed characters [^a-zA-Z0-9\.\-\_\/]) with a dash.
     */
    pathNormalizer: (path: string) => string;

    baseUrl?: string;

    /**
     * Transforms a given path to a public URL.
     */
    urlBuilder: (path: string) => string;
}

export class Storage {
    options: StorageOptions = {
        visibility: 'private',
        directoryVisibility: 'private',
        pathNormalizer: (path: string) => {
            return path.replace(/[^a-zA-Z0-9\.\-\_]/g, '-');
        },
        urlBuilder: (path: string) => {
            if (this.options.baseUrl) return this.options.baseUrl + path;
            return path;
        }
    };

    constructor(
        public adapter: StorageAdapter,
        options: Partial<StorageOptions> = {}
    ) {
        Object.assign(this.options, options);
        if (this.options.baseUrl?.endsWith('/')) this.options.baseUrl = this.options.baseUrl.slice(0, -1);
    }

    /**
     * Closes the adapter (close connections, etc).
     */
    async close() {
        if (this.adapter.close) await this.adapter.close();
    }

    /**
     * Reads a file from local file system.
     */
    async readLocalFile(path: string): Promise<Uint8Array | undefined> {
        const file = await this.adapter.get(path);
        if (!file) return undefined;
        return await readFile(file.path);
    }

    /**
     * Returns all files (and directories) directly in the given folder.
     *
     * Returns a Progress object that can be used to track the progress of the operation.
     */
    files(path: StoragePath): Operation<StorageFile[]> {
        path = resolveStoragePath(path);
        return createProgress<StorageFile[]>(async (reporter) => {
            const files = await this.adapter.files(path as string, reporter);
            files.sort(compareFileSorting);
            return files;
        });
    }

    /**
     * Returns all files (and directories) paths in the given folder.
     *
     * Returns a Progress object that can be used to track the progress of the operation.
     */
    fileNames(path: StoragePath): Operation<string[]> {
        path = resolveStoragePath(path);
        return createProgress<string[]>(async (reporter) => {
            //todo: some adapters might be able to do this more efficiently
            const files = await this.adapter.files(path as string, reporter);
            files.sort(compareFileSorting);
            return files.map(v => v.path);
        });
    }

    /**
     * Returns all files (and directories) in the given folder and all subfolders.
     *
     * Returns a Progress object that can be used to track the progress of the operation.
     */
    allFiles(path: StoragePath): Operation<StorageFile[]> {
        path = resolveStoragePath(path);
        return createProgress<StorageFile[]>(async (reporter) => {
            if (this.adapter.allFiles) {
                const files = await this.adapter.allFiles(path as string, reporter);
                files.sort(compareFileSorting);
                return files;
            } else {
                // const files = await this.adapter.files(path as string, reporter);
                const result: StorageFile[] = [];
                const queue: string[] = [path as string];
                while (queue.length) {
                    const path = queue.shift()!;
                    const files = await this.adapter.files(path, reporter);
                    for (const file of files) {
                        result.push(file);
                        if (file.isDirectory()) {
                            queue.push(file.path);
                        }
                    }
                }
                result.sort(compareFileSorting);
                return result;
            }
        });
    }

    /**
     * Returns all files (and directories) paths in the given folder and all subfolders.
     *
     * Returns a Progress object that can be used to track the progress of the operation.
     */
    allFileNames(path: StoragePath): Operation<string[]> {
        path = resolveStoragePath(path);
        return createProgress<string[]>(async (reporter) => {
            const files = await this.allFiles(path as string);
            files.sort(compareFileSorting);
            return files.map(v => v.path);
        });
    }

    /**
     * Returns all directories directly in the given folder.
     *
     * Returns a Progress object that can be used to track the progress of the operation.
     */
    directories(path: StoragePath): Operation<StorageFile[]> {
        path = resolveStoragePath(path);
        return createProgress<StorageFile[]>(async (reporter) => {
            if (this.adapter.directories) {
                return await this.adapter.directories(path as string, reporter);
            } else {
                const files = await this.adapter.files(path as string, reporter);
                return files.filter(v => v.isDirectory());
            }
        });
    }

    /**
     * Returns all directories in the given folder and all subfolders.
     *
     * Returns a Progress object that can be used to track the progress of the operation.
     */
    allDirectories(path: StoragePath): Operation<StorageFile[]> {
        path = resolveStoragePath(path);
        return createProgress<StorageFile[]>(async (reporter) => {
            if (this.adapter.allDirectories) {
                return await this.adapter.allDirectories(path as string, reporter);
            } else {
                const files = await this.allFiles(path as string);
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
    write(path: StoragePath, content: Uint8Array | string, visibility?: FileVisibility): Operation<void> {
        visibility = visibility || this.options.visibility;
        path = resolveStoragePath(path);
        const buffer = typeof content === 'string' ? new TextEncoder().encode(content) : content;
        return createProgress<void>(async (reporter) => {
            return await this.adapter.write(path as string, buffer, visibility!, reporter);
        });
    }

    /**
     * Writes a given file reference (with path pointing to the file, e.g. UploadedFile) to the given directory.
     *
     * If no name is given, the basename of the file path is used.
     *
     * Returns the path to the saved file, so it can be used to store the path in a database.
     *
     * @example
     * ```typescript
     * storage.writeFile('uploads', uploadedFile);
     * storage.writeFile('uploads', uploadedFile, {name: user.id});
     * ```
     */
    async writeFile(directory: string, file: { path: string }, options: { name?: string, visibility?: string } = {}): Promise<string> {
        const path = (options.name ? options.name : pathBasename(file.path));
        const content = await this.readLocalFile(file.path);
        if (!content) throw new StorageError(`Can not write file, since ${file.path} not found`);
        const targetPath = resolveStoragePath([directory, path]);
        await this.write(targetPath, content);
        return targetPath;
    }

    /**
     * Appends the given content to the given file.
     *
     * Warning: On many storage adapters this loads the whole file first into memory.
     */
    append(path: StoragePath, content: Uint8Array | string): Operation<void> {
        path = resolveStoragePath(path);
        const buffer = typeof content === 'string' ? new TextEncoder().encode(content) : content;
        return createProgress<void>(async (reporter) => {
            if (this.adapter.append) return await this.adapter.append(path as string, buffer, reporter);

            const file = await this.get(path);
            const existing = await this.read(path);
            return await this.adapter.write(path as string, Buffer.concat([existing, buffer]), file.visibility, reporter);
        });
    }

    /**
     * Prepends the given content to the given file.
     *
     * Warning: On almost all storage adapters this loads the whole file first into memory.
     */
    prepend(path: StoragePath, content: Uint8Array | string): Operation<void> {
        path = resolveStoragePath(path);
        const buffer = typeof content === 'string' ? new TextEncoder().encode(content) : content;
        return createProgress<void>(async (reporter) => {
            if (this.adapter.prepend) return await this.adapter.prepend(path as string, buffer, reporter);

            const file = await this.get(path);
            const existing = await this.read(path);
            return await this.adapter.write(path as string, Buffer.concat([buffer, existing]), file.visibility, reporter);
        });
    }

    /**
     * Reads the contents of the given path as binary.
     *
     * Returns a Progress object that can be used to track the progress of the operation.
     */
    read(path: StoragePath): Operation<Uint8Array> {
        path = resolveStoragePath(path);
        return createProgress<Uint8Array>(async (reporter) => {
            return await this.adapter.read(path as string, reporter);
        });
    }

    /**
     * Reads the contents of the given path as string.
     *
     * Returns a Progress object that can be used to track the progress of the operation.
     */
    readAsText(path: StoragePath): Operation<string> {
        path = resolveStoragePath(path);
        return createProgress<string>(async (reporter) => {
            const contents = await this.adapter.read(path as string, reporter);
            return new TextDecoder().decode(contents);
        });
    }

    /**
     * Returns the file at the given path.
     *
     * @throws StorageFileNotFound if the file does not exist.
     */
    async get(path: StoragePath): Promise<StorageFile> {
        path = resolveStoragePath(path);
        const file = await this.adapter.get(path);
        if (!file) throw new StorageFileNotFound('File not found');
        return file;
    }

    /**
     * Returns the file at the given path or undefined if not existing.
     */
    getOrUndefined(path: StoragePath): Promise<StorageFile | undefined> {
        path = resolveStoragePath(path);
        return this.adapter.get(path);
    }

    /**
     * Returns true if all the given paths exist.
     */
    exists(path: StoragePath | StoragePath[]): Promise<boolean> {
        const paths = (Array.isArray(path) ? path : [path]).map(v => resolveStoragePath(v));
        return this.adapter.exists(paths);
    }

    /**
     * Deletes all the given paths.
     * Does nothing if the file does not exist.
     */
    async delete(path: StoragePath | StoragePath[]): Promise<void> {
        const paths = (Array.isArray(path) ? path : [path]).map(v => resolveStoragePath(v));
        await this.adapter.delete(paths);
    }

    /**
     * Deletes the directory at the given path and all files and directories in it recursively.
     */
    deleteDirectory(path: StoragePath): Operation<void> {
        path = resolveStoragePath(path);
        return createProgress<void>(async (reporter) => {
            return this.adapter.deleteDirectory(path as string, reporter);
        });
    }

    /**
     * Copies the file or directory from source to destination, recursively.
     */
    copy(source: StoragePath, destination: StoragePath): Operation<void> {
        source = resolveStoragePath(source);
        destination = resolveStoragePath(destination);
        return createProgress<void>(async (reporter) => {
            if (this.adapter.copy) {
                return this.adapter.copy(source as string, destination as string, reporter);
            } else {
                const file = await this.get(source);
                const queue: { file: StorageFile, targetPath: string }[] = [
                    { file, targetPath: destination as string }
                ];
                while (queue.length) {
                    const entry = queue.shift()!;
                    if (entry.file.isDirectory()) {
                        const files = await this.files(entry.file.path);
                        for (const file of files) {
                            queue.push({ file, targetPath: pathJoin(entry.targetPath, file.name) });
                        }
                    } else {
                        await this.adapter.write(entry.targetPath, await this.adapter.read(entry.file.path, reporter), entry.file.visibility, reporter);
                    }
                }
            }
        });
    }

    /**
     * Moves the file or directory from source to destination, recursively.
     *
     * This might or might not be an atomic operation. If the adapter does not support moving,
     * it will emulate it by doing it manually by copying and then deleting. While it copies,
     * the source file keeps existing, so it's not atomic. If the process crashes, the source
     * and destination might be in an inconsistent state.
     */
    move(source: StoragePath, destination: StoragePath): Operation<void> {
        source = resolveStoragePath(source);
        destination = resolveStoragePath(destination);
        return createProgress<void>(async (reporter) => {
            if (this.adapter.move) {
                return this.adapter.move(source as string, destination as string, reporter);
            } else {
                await this.copy(source, destination);
                await this.delete(source);
            }
        });
    }

    /**
     * Creates a new directory, and all parent directories if not existing.
     */
    makeDirectory(path: StoragePath, visibility?: FileVisibility): Promise<void> {
        visibility = visibility || this.options.directoryVisibility;
        path = resolveStoragePath(path);
        return this.adapter.makeDirectory(path, visibility);
    }

    /**
     * Returns the public URL for the given path.
     */
    async publicUrl(path: StoragePath): Promise<string> {
        path = resolveStoragePath(path);
        if (this.adapter.publicUrl) return await this.adapter.publicUrl(path);

        return this.options.urlBuilder(path);
    }

    /**
     * Sets the visibility of the given path.
     */
    async setVisibility(path: StoragePath, visibility: FileVisibility): Promise<void> {
        if (!this.adapter.setVisibility) return;
        await this.adapter.setVisibility(resolveStoragePath(path), visibility);
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
    return lastSlash <= 0 ? '/' : path.slice(0, lastSlash);
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
    path = pathNormalize(path);
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
