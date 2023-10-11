import { FilesystemAdapter, FilesystemFile, FileVisibility, pathDirectory, pathNormalize, Reporter, resolveFilesystemPath } from '@deepkit/filesystem';
import { Bucket, File, Storage, StorageOptions } from '@google-cloud/storage';
import { fixAsyncOperation } from '@deepkit/core';

export interface FilesystemGoogleOptions extends StorageOptions {
    bucket: string;
    path: string;
}

export class FilesystemGoogleAdapter implements FilesystemAdapter {
    client: Storage;
    bucket: Bucket;
    options: FilesystemGoogleOptions = {
        bucket: '',
        path: '',
    };

    constructor(options: Partial<FilesystemGoogleOptions> = {}) {
        Object.assign(this.options, options);
        this.client = new Storage(this.options);
        this.bucket = this.client.bucket(this.options.bucket);
        this.options.path = this.options.path ? pathNormalize(this.options.path) : '';
    }

    supportsVisibility() {
        return true;
    }

    supportsDirectory() {
        return true;
    }

    protected getRemotePath(path: string): string {
        if (this.options.path === '') return path[0] === '/' ? path.slice(1) : path;
        return resolveFilesystemPath([this.options.path, path]).slice(1); //no leading slash
    }

    async getVisibility(path: string): Promise<FileVisibility> {
        const file = await this.get(path);
        if (!file) throw new Error(`File ${path} not found`);
        return file.visibility;
    }

    async setVisibility(path: string, visibility: FileVisibility): Promise<void> {
        if (visibility === 'public') {
            await fixAsyncOperation(this.bucket.file(this.getRemotePath(path)).makePublic());
        } else if (visibility === 'private') {
            await fixAsyncOperation(this.bucket.file(this.getRemotePath(path)).makePrivate());
        }
    }

    publicUrl(path: string): string {
        return this.bucket.file(this.getRemotePath(path)).publicUrl();
    }

    async close(): Promise<void> {
    }

    async makeDirectory(path: string, visibility: FileVisibility): Promise<void> {
        if (path === '/') return;
        const file = this.bucket.file(this.getRemotePath(path) + '/');
        await fixAsyncOperation(file.save('', { public: visibility === 'public' }));
    }

    protected mapRemotePathToLocal(path: string): string {
        path = pathNormalize(path);
        if (this.options.path === '') return path;
        return path.slice(this.options.path.length);
    }

    async files(path: string): Promise<FilesystemFile[]> {
        return await this.getFiles(path, false);
    }

    async allFiles(path: string): Promise<FilesystemFile[]> {
        return await this.getFiles(path, true);
    }

    async getFiles(path: string, recursive: boolean = false): Promise<FilesystemFile[]> {
        const result: FilesystemFile[] = [];

        const dir = this.getRemotePath(path) + '/';
        const files = await fixAsyncOperation(this.bucket.getFiles({
            prefix: dir,
            delimiter: recursive ? undefined : '/',
            includeTrailingDelimiter: !recursive,
            autoPaginate: false,
        }));

        const prefixes: string[] = (files[2] && (files[2] as any).prefixes) || [];
        for (const folder of prefixes) {
            if (folder === dir) continue;
            result.push(new FilesystemFile(this.mapRemotePathToLocal(folder), 'directory'));
        }

        for (const file of files[0]) {
            if (prefixes.includes(file.name)) continue;
            if (file.name === dir) continue;
            result.push(this.createFilesystemFile(this.mapRemotePathToLocal(file.name), file));
        }

        return result;
    }

    async get(path: string): Promise<FilesystemFile | undefined> {
        const files = await fixAsyncOperation(this.bucket.getFiles({
            prefix: this.getRemotePath(path),
            maxResults: 2,
            autoPaginate: false,
        }));

        const first = files[0][0];
        if (!first) return;
        if (first.name !== this.getRemotePath(path) && first.name !== this.getRemotePath(path) + '/') return;
        const file = this.createFilesystemFile(path, first);
        file.visibility = 'private';

        const rules = await first.acl.get();
        for (const rule of rules) {
            if (Array.isArray(rule)) {
                for (const o of rule) {
                    if (o.entity === 'allUsers' && o.role === 'READER') {
                        file.visibility = 'public';
                        break;
                    }
                }
            }
        }

        return file;
    }

    async delete(paths: string[]): Promise<void> {
        for (const path of paths) {
            await fixAsyncOperation(this.bucket.file(this.getRemotePath(path)).delete({ ignoreNotFound: true }));
        }
    }

    async deleteDirectory(path: string, reporter: Reporter): Promise<void> {
        await fixAsyncOperation(this.bucket.deleteFiles({
            prefix: this.getRemotePath(path) + '/',
        }));
    }

    async exists(paths: string[]): Promise<boolean> {
        for (const path of paths) {
            if (path === '/') continue;
            const exists = await fixAsyncOperation(this.bucket.file(this.getRemotePath(path)).exists());
            if (!exists[0]) return false;
        }

        return true;
    }

    protected createFilesystemFile(path: string, fileInfo: File): FilesystemFile {
        //if path is a directory, we have in first.name trailing slash
        const type = fileInfo.name.endsWith('/') ? 'directory' : 'file';
        const file = new FilesystemFile(path, type);
        if (fileInfo.metadata.size) file.size = Number(fileInfo.metadata.size);
        if (fileInfo.metadata.updated) file.lastModified = new Date(fileInfo.metadata.updated);
        return file;
    }

    async moveFile(source: string, destination: string): Promise<void> {
        await fixAsyncOperation(this.bucket.file(this.getRemotePath(source)).move(this.getRemotePath(destination)));
    }

    async copyFile(source: string, destination: string): Promise<void> {
        await fixAsyncOperation(this.bucket.file(this.getRemotePath(source)).copy(this.getRemotePath(destination)));
    }

    async read(path: string, reporter: Reporter): Promise<Uint8Array> {
        const file = this.bucket.file(this.getRemotePath(path));
        const content = await fixAsyncOperation(file.download());
        return content[0];
    }

    async write(path: string, contents: Uint8Array, visibility: FileVisibility, reporter: Reporter): Promise<void> {
        await this.makeDirectory(pathDirectory(path), visibility);
        const file = this.bucket.file(this.getRemotePath(path));
        await fixAsyncOperation(file.save(Buffer.from(contents), {
            public: visibility === 'public',
        }));
    }
}
