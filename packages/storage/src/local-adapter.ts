import { FileType, FileVisibility, pathDirectory, pathNormalize, Reporter, resolveStoragePath, StorageAdapter, StorageFile } from './storage.js';
import type * as fs from 'fs/promises';

export interface StorageLocalAdapterOptions {
    root: string;
    url: string;
    permissions: {
        file: {
            public: number; //default 0644
            private: number; //default 0.600
        },
        directory: {
            public: number; //default 0755
            private: number; //default 0.700
        }
    };
}

export class StorageNodeLocalAdapter implements StorageAdapter {
    fs?: typeof fs;

    protected root: string;
    protected options: StorageLocalAdapterOptions = {
        root: '/',
        url: '/',
        permissions: {
            file: {
                public: 0o644,
                private: 0o600
            },
            directory: {
                public: 0o755,
                private: 0o700
            }
        }
    };

    constructor(options: Partial<StorageLocalAdapterOptions>) {
        this.root = options.root ? pathNormalize(options.root) : '/';
        Object.assign(this.options, options);
    }

    supportsVisibility() {
        return true;
    }

    protected async getFs(): Promise<typeof fs> {
        if (!this.fs) this.fs = await import('fs/promises');
        return this.fs;
    }

    /**
     * Mode is a number returned from Node's stat operation.
     */
    protected mapModeToVisibility(type: FileType, mode: number): FileVisibility {
        const permissions = this.options.permissions[type === FileType.File ? 'file' : 'directory'];
        const fileMode = mode & 0o777;
        if (fileMode === permissions.public) return 'public';
        return 'private';
    }

    async url(path: string): Promise<string> {
        return resolveStoragePath([this.options.url || this.options.root, path]);
    }

    getMode(type: FileType, visibility: FileVisibility): number {
        const permissions = this.options.permissions[type === FileType.File ? 'file' : 'directory'];
        return visibility === 'public' ? permissions.public : permissions.private;
    }

    getPath(path: string): string {
        return this.root + path;
    }

    async copy(source: string, destination: string, reporter: Reporter): Promise<void> {
        source = this.getPath(source);
        destination = this.getPath(destination);
        const fs = await this.getFs();
        await fs.cp(source, destination, { recursive: true });
    }

    async delete(paths: string[]): Promise<void> {
        const fs = await this.getFs();
        for (const path of paths) {
            await fs.rm(this.getPath(path));
        }
    }

    async makeDirectory(path: string, visibility: FileVisibility): Promise<void> {
        const fs = await this.getFs();
        await fs.mkdir(this.getPath(path), { recursive: true, mode: this.getMode(FileType.Directory, visibility) });
    }

    async deleteDirectory(path: string, reporter: Reporter): Promise<void> {
        path = this.getPath(path);
        const fs = await this.getFs();
        await fs.rm(path, { recursive: true });
    }

    async exists(paths: string[]): Promise<boolean> {
        const fs = await this.getFs();
        for (const path of paths) {
            try {
                const res = await fs.stat(this.getPath(path));
                if (!res.isFile() && !res.isDirectory()) return false;
            } catch (error: any) {
                return false;
            }
        }
        return true;
    }

    async files(path: string): Promise<StorageFile[]> {
        const localPath = this.getPath(path);
        const files: StorageFile[] = [];
        const fs = await this.getFs();

        for (const name of await fs.readdir(localPath)) {
            const file = new StorageFile(path + '/' + name);
            const stat = await fs.stat(localPath + '/' + name);
            file.size = stat.isFile() ? stat.size : 0;
            file.lastModified = new Date(stat.mtime);
            file.visibility = this.mapModeToVisibility(stat.isFile() ? FileType.File : FileType.Directory, stat.mode);
            file.type = stat.isFile() ? FileType.File : FileType.Directory;
            files.push(file);
        }

        return files;
    }

    async allFiles(path: string, reporter: Reporter): Promise<StorageFile[]> {
        const files: StorageFile[] = [];
        const fs = await this.getFs();

        const queue: string[] = [path];
        while (!reporter.aborted && queue.length) {
            const currentPath = queue.shift()!;
            for (const name of await fs.readdir(this.getPath(currentPath))) {
                if (reporter.aborted) return files;
                const file = new StorageFile(currentPath + '/' + name);
                const stat = await fs.stat(this.getPath(currentPath + '/' + name));
                file.size = stat.isFile() ? stat.size : 0;
                file.lastModified = new Date(stat.mtime);
                file.visibility = this.mapModeToVisibility(stat.isFile() ? FileType.File : FileType.Directory, stat.mode);
                file.type = stat.isFile() ? FileType.File : FileType.Directory;
                files.push(file);
                reporter.progress(files.length, 0);
                if (file.isDirectory()) queue.push(file.path);
            }
        }

        return files;
    }

    async directories(path: string): Promise<StorageFile[]> {
        return (await this.files(path)).filter(file => file.isDirectory());
    }

    async allDirectories(path: string, reporter: Reporter): Promise<StorageFile[]> {
        const files: StorageFile[] = [];
        const fs = await this.getFs();

        const queue: string[] = [path];
        while (!reporter.aborted && queue.length) {
            const currentPath = queue.shift()!;
            for (const name of await fs.readdir(this.getPath(currentPath))) {
                if (reporter.aborted) return files;
                const file = new StorageFile(currentPath + '/' + name);
                const stat = await fs.stat(this.getPath(currentPath + '/' + name));
                if (!stat.isDirectory()) continue;
                file.size = stat.isFile() ? stat.size : 0;
                file.lastModified = new Date(stat.mtime);
                file.visibility = this.mapModeToVisibility(stat.isFile() ? FileType.File : FileType.Directory, stat.mode);
                file.type = stat.isFile() ? FileType.File : FileType.Directory;
                files.push(file);
                reporter.progress(files.length, 0);
                if (file.isDirectory()) queue.push(file.path);
            }
        }

        return files;
    }

    async get(path: string): Promise<StorageFile | undefined> {
        const localPath = this.getPath(path);
        const fs = await this.getFs();
        const file = new StorageFile(path);
        try {
            const stat = await fs.stat(localPath);
            file.size = stat.isFile() ? stat.size : 0;
            file.lastModified = new Date(stat.mtime);
            file.visibility = this.mapModeToVisibility(stat.isFile() ? FileType.File : FileType.Directory, stat.mode);
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
        return await fs.readFile(path);
    }

    async write(path: string, contents: Uint8Array, visibility: FileVisibility, reporter: Reporter): Promise<void> {
        path = this.getPath(path);
        const fs = await this.getFs();
        await fs.mkdir(pathDirectory(path), { recursive: true, mode: this.getMode(FileType.Directory, visibility) });
        await fs.writeFile(path, contents, { mode: this.getMode(FileType.File, visibility) });
    }

    async append(path: string, contents: Uint8Array, reporter: Reporter): Promise<void> {
        path = this.getPath(path);
        const fs = await this.getFs();
        await fs.appendFile(path, contents);
    }
}

export const StorageLocalAdapter = StorageNodeLocalAdapter;
