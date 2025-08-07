import { ClientProgress, Progress } from '@deepkit/rpc';
import { computed, Injectable, signal } from '@angular/core';
import { pathBasename } from '@deepkit/core';

export interface FileQueueEntry {
    name: string;
    dir: string;
    data: Uint8Array;
    addFile: (name: string, dir: string, data: Uint8Array) => Promise<void>;
    progress?: Progress;
    abort?: () => void;
    done?: true;
    errored?: true;
    aborted?: true;
}

export interface FilesystemApiFile {
    size: number;
    lastModified?: Date;
    visibility: string;

    // not available in Filesystem
    created?: Date;
    mimeType: string;
    path: string;
    type: 'file' | 'directory';
}

export function fileDirectory(file: FilesystemApiFile): string {
    const lastSlash = file.path.lastIndexOf('/');
    return lastSlash <= 0 ? '/' : file.path.slice(0, lastSlash);
}

export function fileName(file: FilesystemApiFile): string {
    return pathBasename(file.path);
}

export function truncateFileName(name: string) {
    //if file name is too long, cut it in the middle and add ...
    const maxLength = 25;
    if (name.length > maxLength) {
        return name.substr(0, maxLength / 2) + '...' + name.substr(name.length - maxLength / 2, name.length);
    }
    return name;
}

export interface FilesystemApi {
    getPublicUrl(path: string): Promise<string>;

    createFolder(path: string): Promise<void>;

    getFile(path: string): Promise<FilesystemApiFile | undefined>;

    getFiles(path: string): Promise<FilesystemApiFile[]>;

    /**
     * Return the full data of the file.
     */
    getData(path: string): Promise<{ data: Uint8Array, mimeType: string } | undefined>;

    // /**
    //  * Return a small preview of the file, e.g. for images or PDFs.
    //  * Could be just the full data if the file is not enormous.
    //  */
    // getQuickLookData(path: string): Promise<{ data: Uint8Array, mimeType: string } | undefined>;

    /**
     * Returns an even smaller preview of the file, e.g. for images or PDFs.
     * Best size is 256x256 pixels.
     */
    getThumbnailData(path: string): Promise<{ data: Uint8Array, mimeType: string } | undefined>;

    renameFile(path: string, newName: string): Promise<string>;

    addFile(name: string, dir: string, data: Uint8Array): Promise<void>;

    remove(paths: string[]): Promise<void>;
}

@Injectable({ providedIn: 'root' })
export class FilesystemState {
    uploadQueue = signal<FileQueueEntry[]>([]);
    pendingQueue = computed(() => this.uploadQueue().filter(file => !file.done && !file.errored && !file.aborted));

    upload = signal<FileQueueEntry | undefined>(undefined);

    addUpload(file: FileQueueEntry) {
        this.uploadQueue.update(v => [...v, file]);
        this.checkNext();
    }

    protected nextCleanQueueTimeout?: ReturnType<typeof setTimeout>;

    cleanQueue() {
        if (this.nextCleanQueueTimeout) return;
        this.nextCleanQueueTimeout = setTimeout(() => {
            this.nextCleanQueueTimeout = undefined;
            this.uploadQueue.set(this.pendingQueue());
        }, 5000);
    }

    checkNext() {
        const upload = this.upload();
        if (upload) return;

        const files = this.pendingQueue();
        if (!files.length) {
            this.cleanQueue();
            return;
        }
        const file = files.find(file => !file.done && !file.errored && !file.aborted);
        if (!file) {
            this.cleanQueue();
            return;
        }

        this.upload.set(file);
        file.progress = ClientProgress.track();
        file.abort = () => {
            file.aborted = true;
            file.progress?.abort();
            this.upload.set(undefined);
            this.uploadQueue.update(v => v.slice());
            this.checkNext();
        };

        console.log('uploading', file.name, file.dir, file.data.length, 'bytes');
        file.addFile(file.name, file.dir, file.data).then(() => {
            file.done = true;
            this.upload.set(undefined);
            this.uploadQueue.update(v => v.slice());
            this.checkNext();
        }, error => {
            file.errored = true;
            this.upload.set(undefined);
            this.uploadQueue.update(v => v.slice());
            this.checkNext();
        });
    }
}
