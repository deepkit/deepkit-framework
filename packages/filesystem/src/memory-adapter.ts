import { pathDirectory } from '@deepkit/core';
import { FilesystemAdapter, FilesystemFile, FilesystemFileNotFound, FileVisibility, pathDirectories, Reporter } from './filesystem.js';

export interface FilesystemMemoryAdapterOptions {
}

/**
 * In-memory filesystem adapter for testing purposes.
 */
export class FilesystemMemoryAdapter implements FilesystemAdapter {
    protected memory: { file: FilesystemFile, contents: Uint8Array }[] = [];

    protected options: FilesystemMemoryAdapterOptions = {
    };

    constructor(options: Partial<FilesystemMemoryAdapterOptions> = {}) {
        Object.assign(this.options, options);
    }

    supportsVisibility() {
        return true;
    }

    supportsDirectory() {
        return true;
    }

    async files(path: string): Promise<FilesystemFile[]> {
        return this.memory.filter(file => file.file.directory === path)
            .map(v => v.file);
    }

    async makeDirectory(path: string, visibility: FileVisibility): Promise<void> {
        const directories = pathDirectories(path);
        //filter out all parts that already exist
        for (const dir of directories) {
            const exists = await this.exists([dir]);
            if (exists) continue;
            const file = new FilesystemFile(dir);
            file.type = 'directory';
            file.visibility = visibility;
            this.memory.push({ file, contents: new Uint8Array });
        }
    }

    async allFiles(path: string): Promise<FilesystemFile[]> {
        return this.memory.filter(file => file.file.inDirectory(path))
            .map(v => v.file);
    }

    async directories(path: string): Promise<FilesystemFile[]> {
        return this.memory.filter(file => file.file.directory === path)
            .filter(file => file.file.isDirectory())
            .map(v => v.file);
    }

    async allDirectories(path: string): Promise<FilesystemFile[]> {
        return this.memory.filter(file => file.file.inDirectory(path))
            .filter(file => file.file.isDirectory())
            .map(v => v.file);
    }

    async write(path: string, contents: Uint8Array, visibility: FileVisibility, reporter: Reporter): Promise<void> {
        let file = this.memory.find(file => file.file.path === path);
        if (!file) {
            await this.makeDirectory(pathDirectory(path), visibility);
            file = { file: new FilesystemFile(path), contents };
            this.memory.push(file);
        }
        file.contents = contents;
        file.file.visibility = visibility;
        file.file.size = contents.length;
        file.file.lastModified = new Date();
    }

    async read(path: string, reporter: Reporter): Promise<Uint8Array> {
        const file = this.memory.find(file => file.file.path === path);
        if (!file) throw new FilesystemFileNotFound('File not found');
        return file.contents;
    }

    async exists(paths: string[]): Promise<boolean> {
        const files = this.memory.filter(file => paths.includes(file.file.path));
        return files.length === paths.length;
    }

    async delete(paths: string[]): Promise<void> {
        const files = this.memory.filter(file => paths.includes(file.file.path));
        for (const file of files) {
            this.memory.splice(this.memory.indexOf(file), 1);
        }
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

    async get(path: string): Promise<FilesystemFile | undefined> {
        return this.memory.find(file => file.file.path === path)?.file;
    }

    async copy(source: string, destination: string, reporter: Reporter): Promise<void> {
        const files = this.memory.filter(file => file.file.path.startsWith(source));
        reporter.progress(0, files.length);
        let i = 0;
        for (const file of files) {
            const newPath = destination + file.file.path.slice(source.length);
            this.memory.push({ file: new FilesystemFile(newPath), contents: file.contents });
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

    async setVisibility(path: string, visibility: FileVisibility): Promise<void> {
        const file = this.memory.find(file => file.file.path === path);
        if (!file) return;
        file.file.visibility = visibility;
    }
}
