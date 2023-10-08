import { File, FileType, pathDirectory, pathNormalize, Reporter, StorageAdapter } from './storage.js';
import type * as fs from 'fs/promises';

export class StorageNodeLocalAdapter implements StorageAdapter {
    fs?: typeof fs;

    constructor(public path: string) {
        this.path = pathNormalize(path);
    }

    protected async getFs(): Promise<typeof fs> {
        if (!this.fs) this.fs = await import('fs/promises');
        return this.fs;
    }

    getPath(path: string): string {
        return this.path + path;
    }

    async copy(source: string, destination: string, reporter: Reporter): Promise<void> {
        source = this.getPath(source);
        destination = this.getPath(destination);
        const fs = await this.getFs();
        await fs.cp(source, destination, { recursive: true });
    }

    async delete(path: string): Promise<void> {
        path = this.getPath(path);
        const fs = await this.getFs();
        await fs.rm(path);
    }

    async deleteDirectory(path: string, reporter: Reporter): Promise<void> {
        path = this.getPath(path);
        const fs = await this.getFs();
        await fs.rm(path, { recursive: true });
    }

    async exists(path: string): Promise<boolean> {
        path = this.getPath(path);
        const fs = await this.getFs();
        try {
            const res = await fs.stat(path);
            return res.isFile() || res.isDirectory();
        } catch (error: any) {
            return false;
        }
    }

    async files(path: string): Promise<File[]> {
        const localPath = this.getPath(path);
        const files: File[] = [];
        const fs = await this.getFs();

        for (const name of await fs.readdir(localPath)) {
            const file = new File(path + '/' + name);
            const stat = await fs.stat(localPath + '/' + name);
            file.size = stat.size;
            file.lastModified = new Date(stat.mtime);
            file.type = stat.isFile() ? FileType.File : FileType.Directory;
            files.push(file);
        }

        return files;
    }

    async get(path: string): Promise<File | undefined> {
        const localPath = this.getPath(path);
        const fs = await this.getFs();
        const file = new File(path);
        try {
            const stat = await fs.stat(localPath);
            file.size = stat.size;
            file.lastModified = new Date(stat.mtime);
            file.type = stat.isFile() ? FileType.File : FileType.Directory;
            return file;
        } catch (error: any) {
            return undefined;
        }
    }

    async move(source: string, destination: string, reporter: Reporter): Promise<void> {
        source = this.getPath(source);
        destination = this.getPath(destination);
        const fs = await this.getFs();
        await fs.rename(source, destination);
    }

    async read(path: string, reporter: Reporter): Promise<Uint8Array> {
        path = this.getPath(path);
        const fs = await this.getFs();
        const content = await fs.readFile(path);
        return content;
    }

    async write(path: string, contents: Uint8Array, reporter: Reporter): Promise<void> {
        path = this.getPath(path);
        const fs = await this.getFs();
        await fs.mkdir(pathDirectory(path), { recursive: true });
        await fs.writeFile(path, contents);
    }
}

export const StorageLocalAdapter = StorageNodeLocalAdapter;
