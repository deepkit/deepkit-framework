import { Injectable, OnDestroy, signal, WritableSignal } from '@angular/core';
import { ClientProgress } from '@deepkit/rpc';
import { FilesystemApi } from './api';

interface CacheState {
    path: string;
    result: WritableSignal<{ data: Uint8Array, mimeType: string } | undefined>;
    loaded?: Date;
    users: number;
    abort?: () => void;
    aborted: WritableSignal<boolean>;
    invalid: WritableSignal<boolean>;
    progress: WritableSignal<number>;
    load: () => Promise<{ data: Uint8Array, mimeType: string } | undefined>;
}

export interface CacheData {
    path: string;
    aborted: WritableSignal<boolean>;
    invalid: WritableSignal<boolean>;
    result: WritableSignal<{ data: Uint8Array, mimeType: string } | undefined>;
    progress: WritableSignal<number>;
    disconnect: () => void;
}

@Injectable()
export abstract class FilesystemFileCache implements OnDestroy {
    protected data = new Map<string, CacheState>();

    protected parallel = 5; // how many files to load in parallel
    protected queue = new Set<CacheState>;
    protected inFlight = 0;

    // 5 minutes
    protected maxAge = 5 * 60 * 1000;

    protected interval: ReturnType<typeof setInterval>;

    constructor() {
        this.interval = setInterval(() => {
            this.clean();
        }, 30_000);
    }

    ngOnDestroy() {
        clearTimeout(this.interval);
    }

    clean() {
        // Remove files older than maxAge
        const now = new Date;
        for (const [path, data] of this.data.entries()) {
            if (!data.loaded) return;
            if (now.getTime() - data.loaded.getTime() > this.maxAge) {
                this.data.delete(path);
            }
        }
    }

    nextQueue() {
        if (this.inFlight >= this.parallel) return;

        for (const queue of this.queue) {
            if (this.inFlight >= this.parallel) return;

            // If cache is not loaded yet, load it
            this.inFlight++;
            const progress = ClientProgress.track();
            const sub = progress.download.subscribe(v => {
                queue.progress.set(v.progress);
            });
            this.queue.delete(queue);
            queue.abort = () => {
                if (queue.loaded) return;
                if (queue.aborted()) return;
                queue.invalid.set(true);
                queue.aborted.set(true);
                progress.abort();
                this.queue.delete(queue);
                this.data.delete(queue.path);
            };
            queue.load().then((result) => {
                this.inFlight--;
                if (!result) queue.invalid.set(true);
                queue.result.set(result);
                queue.loaded = new Date;
                queue.progress.set(1);
                sub.unsubscribe();
                this.nextQueue();
            });
        }
    }

    protected disconnect(path: string) {
        const existing = this.data.get(path);
        if (!existing) return;
        existing.users--;
        if (existing.users <= 0) {
            // make sure queued loading is aborted
            existing.abort?.();
            this.queue.delete(existing);
        }
    }

    connect(api: FilesystemApi, path: string): CacheData {
        const existing = this.data.get(path);
        if (existing) {
            existing.users++;
            return {
                path,
                aborted: existing.aborted,
                invalid: existing.invalid,
                result: existing.result,
                progress: existing.progress,
                disconnect: () => this.disconnect(path),
            };
        }

        const cache: CacheState = {
            path,
            result: signal<{ data: Uint8Array, mimeType: string } | undefined>(undefined),
            users: 1,
            aborted: signal(false),
            invalid: signal(false),
            loaded: new Date,
            progress: signal(0),
            load: () => this.fetchData(api, path).catch(() => undefined),
        };
        this.queue.add(cache);
        this.data.set(path, cache);
        this.nextQueue();

        return {
            path,
            aborted: cache.aborted,
            invalid: cache.invalid,
            result: cache.result,
            progress: cache.progress,
            disconnect: () => this.disconnect(path),
        };
    }

    protected async fetchData(api: FilesystemApi, id: string): Promise<{ data: Uint8Array, mimeType: string } | undefined> {
        throw new Error('Not implemented');
    }
}

@Injectable()
export class FilesystemFileDataCache extends FilesystemFileCache {
    protected async fetchData(api: FilesystemApi, path: string) {
        return await api.getData(path);
    }
}

@Injectable()
export class FilesystemFileQuickLookCache extends FilesystemFileCache {
    protected async fetchData(api: FilesystemApi, path: string) {
        return await api.getData(path);
    }
}

@Injectable()
export class FilesystemFileThumbnailCache extends FilesystemFileCache {
    protected async fetchData(api: FilesystemApi, path: string) {
        return await api.getThumbnailData(path);
    }
}
