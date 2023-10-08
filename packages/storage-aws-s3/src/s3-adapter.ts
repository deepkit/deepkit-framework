import { FileType, pathDirectory, Reporter, StorageAdapter, StorageError, StorageFile } from '@deepkit/storage';
import {
    CopyObjectCommand,
    DeleteObjectCommand,
    DeleteObjectsCommand,
    GetObjectCommand,
    HeadObjectCommand,
    ListObjectsCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    S3Client
} from '@aws-sdk/client-s3';
import { normalizePath } from 'typedoc';

export interface StorageAwsS3Options {
    bucket: string;
    path?: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    endpoint?: string;

    /**
     * If enabled, the adapter will create directories when writing files.
     *
     * Default: true
     */
    directorySupport?: boolean;
}

export class StorageAwsS3Adapter implements StorageAdapter {
    client: S3Client;

    constructor(public options: StorageAwsS3Options) {
        this.client = new S3Client({
            region: options.region,
            credentials: {
                accessKeyId: options.accessKeyId,
                secretAccessKey: options.secretAccessKey,
            },
            endpoint: options.endpoint,
        });
    }

    protected isDirectorySupport(): boolean {
        return this.options.directorySupport !== false;
    }

    protected getRemotePath(path: string) {
        path = normalizePath(path);
        const base = this.options.path ? (normalizePath(this.options.path).slice(0) + '/') : '';
        if (path === '/') return base;
        let remotePath = this.options.path ? base : '';
        remotePath += path === '/' ? '' : path.slice(1);
        return remotePath;
    }

    protected getRemoteDirectory(path: string) {
        path = this.getRemotePath(path);
        return path.endsWith('/') ? path : path + '/';
    }

    protected pathMapToVirtual(path: string): string {
        //remove this.options.path from path
        const base = this.options.path ? (normalizePath(this.options.path).slice(0) + '/') : '';
        return path.slice(base.length);
    }

    async makeDirectory(path: string): Promise<void> {
        if (path === '') return;

        const command = new PutObjectCommand({
            Bucket: this.options.bucket,
            Key: this.getRemoteDirectory(path),
            ContentLength: 0
        });

        try {
            await this.client.send(command);
        } catch (error: any) {
            // that's fine
        }
    }

    async files(path: string): Promise<StorageFile[]> {
        return await this.getFiles(path, false);
    }

    async allFiles(path: string, reporter: Reporter): Promise<StorageFile[]> {
        return await this.getFiles(path, true);
    }

    protected async getFiles(path: string, recursive: boolean = false): Promise<StorageFile[]> {
        const files: StorageFile[] = [];
        const remotePath = this.getRemoteDirectory(path);

        //only v2 includes directories
        const command = new ListObjectsV2Command({
            Bucket: this.options.bucket,
            Prefix: remotePath,
            Delimiter: recursive ? undefined : '/',
        });

        try {
            const response = await this.client.send(command);

            if (response.CommonPrefixes) {
                for (const prefix of response.CommonPrefixes) {
                    if (!prefix.Prefix) continue;
                    const file = new StorageFile(this.pathMapToVirtual(prefix.Prefix));
                    file.type = FileType.Directory;
                    files.push(file);
                }
            }

            if (response.Contents) {
                for (const content of response.Contents) {
                    if (!content.Key) continue;
                    // AWS sends the folder itself, we ignore that
                    if (content.Key === remotePath) continue;

                    const file = new StorageFile(this.pathMapToVirtual(content.Key));
                    file.size = content.Size;
                    file.lastModified = content.LastModified;
                    file.type = content.Key.endsWith('/') ? FileType.Directory : FileType.File;
                    files.push(file);
                }
            }
        } catch (error: any) {
            throw new StorageError(`Could not list files ${path}: ${error.message}`);
        }

        return files;
    }

    async copy(source: string, destination: string, reporter: Reporter): Promise<void> {
        const file = await this.get(source);

        if (file && file.isFile()) {
            if (this.isDirectorySupport()) {
                await this.makeDirectory(pathDirectory(destination));
            }

            const command = new CopyObjectCommand({
                Bucket: this.options.bucket,
                Key: this.getRemotePath(destination),
                CopySource: this.options.bucket + '/' + this.getRemotePath(source),
            });

            try {
                await this.client.send(command);
            } catch (error: any) {
                throw new StorageError(`Could not copy file ${source} to ${destination}: ${error.message}`);
            }
        } else {
            //get all files, copy them
            const files = await this.allFiles(source, reporter);
            for (const file of files) {
                if (file.isDirectory()) continue;

                const from = this.options.bucket + '/' + this.getRemotePath(file.path);
                const to = this.getRemotePath(destination) + '/' + file.path.slice(source.length + 1);
                const command = new CopyObjectCommand({
                    Bucket: this.options.bucket,
                    Key: to,
                    CopySource: from,
                });

                try {
                    await this.client.send(command);
                } catch (error: any) {
                    throw new StorageError(`Could not copy file ${source} to ${destination}: ${error.message}`);
                }
            }
        }
    }

    async delete(path: string): Promise<void> {
        const command = new DeleteObjectCommand({
            Bucket: this.options.bucket,
            Key: this.getRemotePath(path),
        });

        try {
            await this.client.send(command);
        } catch (error: any) {
            // that's fine
        }
    }

    async deleteDirectory(path: string, reporter: Reporter): Promise<void> {
        const files = await this.client.send(new ListObjectsCommand({
            Bucket: this.options.bucket,
            Prefix: this.getRemoteDirectory(path),
        }));

        if (!files.Contents) return;

        const command = new DeleteObjectsCommand({
            Bucket: this.options.bucket,
            Delete: {
                Objects: files.Contents.map(v => ({ Key: v.Key })) || [],
            }
        });

        try {
            await this.client.send(command);
        } catch (error: any) {
            // that's fine
        }
    }

    async exists(path: string): Promise<boolean> {
        const command = new HeadObjectCommand({
            Bucket: this.options.bucket,
            Key: this.getRemotePath(path),
        });

        try {
            const response = await this.client.send(command);
            return true;
        } catch (error: any) {
            return false;
        }
    }

    async get(path: string): Promise<StorageFile | undefined> {
        const file = new StorageFile(path);
        const remotePath = this.getRemotePath(path);

        const command = new GetObjectCommand({
            Bucket: this.options.bucket,
            Key: remotePath,
        });
        try {
            const response = await this.client.send(command);
            file.size = response.ContentLength;
            file.lastModified = response.LastModified;
        } catch (error: any) {
            return undefined;
        }

        return file;
    }

    async move(source: string, destination: string, reporter: Reporter): Promise<void> {
        await this.copy(source, destination, reporter);
        await this.delete(source);
        await this.deleteDirectory(source, reporter);
    }

    async read(path: string, reporter: Reporter): Promise<Uint8Array> {
        const remotePath = this.getRemotePath(path);

        const command = new GetObjectCommand({
            Bucket: this.options.bucket,
            Key: remotePath,
        });

        try {
            const response = await this.client.send(command);
            if (!response.Body) throw new StorageError(`Could not read file ${path}: No body in response`);
            return await response.Body.transformToByteArray();
        } catch (error: any) {
            throw new StorageError(`Could not read file ${path}: ${error.message}`);
        }
    }

    async write(path: string, contents: Uint8Array, reporter: Reporter): Promise<void> {
        if (this.isDirectorySupport()) {
            await this.makeDirectory(pathDirectory(path));
        }

        const remotePath = this.getRemotePath(path);
        const command = new PutObjectCommand({
            Bucket: this.options.bucket,
            Key: remotePath,
            Body: contents,
        });

        try {
            const response = await this.client.send(command);
        } catch (error: any) {
            throw new StorageError(`Could not write file ${path}: ${error.message}`);
        }
    }
}
