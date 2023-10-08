import { asyncOperation } from '@deepkit/core';

export enum FileType {
    File,
    Directory,
    SymbolicLink,
    Unknown,
}

export function pathNormalize(path: string): string {
    path = path[0] !== '/' ? '/' + path : path;
    path = path.length > 1 && path[path.length - 1] === '/' ? path.slice(0, -1) : path;
    return path.replace(/\/+/g, '/');
}

export function pathDirectory(path: string): string {
    if (path === '/') return '/';
    const lastSlash = path.lastIndexOf('/');
    return lastSlash === -1 ? '' : path.slice(0, lastSlash);
}

export class File {
    public size?: number;
    public type: FileType = FileType.File;
    public lastModified?: Date;

    constructor(public path: string) {
        this.path = pathNormalize(path);
    }

    isFile(): boolean {
        return this.type === FileType.File;
    }

    isDirectory(): boolean {
        return this.type === FileType.Directory;
    }

    get name() {
        const lastSlash = this.path.lastIndexOf('/');
        return lastSlash === -1 ? this.path : this.path.slice(lastSlash + 1);
    }

    get directory() {
        const lastSlash = this.path.lastIndexOf('/');
        return lastSlash === -1 ? '' : this.path.slice(0, lastSlash);
    }

    get extension() {
        const lastDot = this.path.lastIndexOf('.');
        return lastDot === -1 ? '' : this.path.slice(lastDot + 1);
    }
}

export interface Progress<T> extends Promise<T> {
    onProgress(callback: (loaded: number, total: number) => void): this;

    abort(): Promise<void>;
}

export interface Storage {
    // write(path: string, contents: string | Uint8Array): Progress<void>;
    //
    // read(path: string): Progress<Uint8Array>;
    //
    // delete(path: string): Promise<void>;
    //
    // deleteDirectory(path: string): Promise<void>;

    // exists(path: string): Promise<boolean>;

    // files(path: string): Promise<File[]>;

    allFiles(path: string): Promise<File[]>;

    directories(path: string): Promise<File[]>;

    allDirectories(path: string): Promise<File[]>;

    copy(source: string, destination: string): Promise<void>;

    move(source: string, destination: string): Promise<void>;

    sizeDirectory(path: string): Promise<number>;
}

export interface StorageAdapter {
    files(path: string): Promise<File[]>;

    write(path: string, contents: Uint8Array, reporter: Reporter): Promise<void>;

    read(path: string, reporter: Reporter): Promise<Uint8Array>;

    get(path: string): Promise<File | undefined>;

    exists(path: string): Promise<boolean>;

    delete(path: string): Promise<void>;

    deleteDirectory(path: string, reporter: Reporter): Promise<void>;

    copy(source: string, destination: string, reporter: Reporter): Promise<void>;

    move(source: string, destination: string, reporter: Reporter): Promise<void>;
}

export class FileNotFound extends Error {
}

export type Reporter = { progress: (loaded: number, total: number) => void, onAbort: () => Promise<void> };

export function createProgress<T>(callback: (reporter: Reporter) => Promise<T>): Progress<T> {
    const callbacks: ((loaded: number, total: number) => void)[] = [];

    const reporter = {
        progress: (loaded: number, total: number) => {
            for (const callback of callbacks) callback(loaded, total);
        },
        onAbort: () => Promise.resolve()
    };

    const promise = asyncOperation<T>(async (resolve, reject) => {
        resolve(await callback(reporter));
    }) as Progress<T>;

    promise.onProgress = (callback: (loaded: number, total: number) => void) => {
        callbacks.push(callback);
        return promise;
    };

    promise.abort = async () => {
        await reporter.onAbort();
    };

    return promise;
}

export class StorageMemoryAdapter implements StorageAdapter {
    protected memory: { file: File, contents: Uint8Array }[] = [];

    async files(path: string): Promise<File[]> {
        return this.memory.filter(file => file.file.path.startsWith(path)).map(v => v.file);
    }

    async write(path: string, contents: Uint8Array, reporter: Reporter): Promise<void> {
        let file = this.memory.find(file => file.file.path === path);
        if (!file) {
            file = { file: new File(path), contents };
            this.memory.push(file);
        }
        file.contents = contents;
        file.file.size = contents.length;
        file.file.lastModified = new Date();
    }

    async read(path: string, reporter: Reporter): Promise<Uint8Array> {
        const file = this.memory.find(file => file.file.path === path);
        if (!file) throw new FileNotFound('File not found');
        return file.contents;
    }

    async exists(path: string): Promise<boolean> {
        return !!this.memory.find(file => file.file.path === path);
    }

    async delete(path: string): Promise<void> {
        const index = this.memory.findIndex(file => file.file.path === path);
        if (index === -1) throw new FileNotFound('File not found');
        this.memory.splice(index, 1);
    }

    async deleteDirectory(path: string, reporter: Reporter): Promise<void> {
        const files = this.memory.filter(file => file.file.path.startsWith(path));
        reporter.progress(0, files.length);
        let i = 0;
        for (const file of files) {
            this.memory.splice(this.memory.indexOf(file), 1);
            reporter.progress(++i, files.length);
        }
    }

    async get(path: string): Promise<File | undefined> {
        return this.memory.find(file => file.file.path === path)?.file;
    }

    async copy(source: string, destination: string, reporter: Reporter): Promise<void> {
        const files = this.memory.filter(file => file.file.path.startsWith(source));
        reporter.progress(0, files.length);
        let i = 0;
        for (const file of files) {
            const newPath = destination + file.file.path.slice(source.length);
            this.memory.push({ file: new File(newPath), contents: file.contents });
            reporter.progress(++i, files.length);
        }
    }

    async move(source: string, destination: string, reporter: Reporter): Promise<void> {
        const files = this.memory.filter(file => file.file.path.startsWith(source));
        reporter.progress(0, files.length);
        let i = 0;
        for (const file of files) {
            const newPath = destination + file.file.path.slice(source.length);
            file.file.path = newPath;
            reporter.progress(++i, files.length);
        }
    }
}

export class Storage {
    constructor(public adapter: StorageAdapter) {
    }

    protected normalizePath(path: string): string {
        return pathNormalize(path);
    }

    files(path: string): Promise<File[]> {
        path = this.normalizePath(path);
        return this.adapter.files(path);
    }

    write(path: string, content: Uint8Array | string): Progress<void> {
        path = this.normalizePath(path);
        const buffer = typeof content === 'string' ? new TextEncoder().encode(content) : content;
        return createProgress<void>(async (reporter) => {
            return await this.adapter.write(path, buffer, reporter);
        });
    }

    read(path: string): Progress<Uint8Array> {
        path = this.normalizePath(path);
        return createProgress<Uint8Array>(async (reporter) => {
            return await this.adapter.read(path, reporter);
        });
    }

    readAsText(path: string): Progress<string> {
        path = this.normalizePath(path);
        return createProgress<string>(async (reporter) => {
            const contents = await this.adapter.read(path, reporter);
            return new TextDecoder().decode(contents);
        });
    }

    async get(path: string): Promise<File> {
        path = this.normalizePath(path);
        const file = await this.adapter.get(path);
        if (!file) throw new FileNotFound('File not found');
        return file;
    }

    getOrUndefined(path: string): Promise<File | undefined> {
        path = this.normalizePath(path);
        return this.adapter.get(path);
    }

    exists(path: string): Promise<boolean> {
        path = this.normalizePath(path);
        return this.adapter.exists(path);
    }

    delete(path: string): Promise<void> {
        path = this.normalizePath(path);
        return this.adapter.delete(path);
    }

    deleteDirectory(path: string): Progress<void> {
        path = this.normalizePath(path);
        return createProgress<void>(async (reporter) => {
            return this.adapter.deleteDirectory(path, reporter);
        });
    }

    copy(source: string, destination: string): Progress<void> {
        source = this.normalizePath(source);
        destination = this.normalizePath(destination);
        return createProgress<void>(async (reporter) => {
            return this.adapter.copy(source, destination, reporter);
        });
    }

    move(source: string, destination: string): Progress<void> {
        source = this.normalizePath(source);
        destination = this.normalizePath(destination);
        return createProgress<void>(async (reporter) => {
            return this.adapter.move(source, destination, reporter);
        });
    }
}
