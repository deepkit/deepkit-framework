import { Filesystem, FilesystemFile, FilesystemLocalAdapter } from '@deepkit/filesystem';
import { AppModule } from '@deepkit/app';
import { ClassType, pathJoin, pathNormalizeDirectory } from '@deepkit/core';
import { InjectorContext } from '@deepkit/injector';
import { HttpResponse, httpWorkflow } from '@deepkit/http';
import { InlineRuntimeType, ReceiveType } from '@deepkit/type';

export class FilesystemRegistry {
    protected filesystems: { classType: ClassType, module: AppModule<any> }[] = [];

    constructor(protected injectorContext: InjectorContext) {
    }

    addFilesystem(classType: ClassType, module: AppModule<any>) {
        this.filesystems.push({ classType, module });
    }

    getFilesystems(): Filesystem[] {
        return this.filesystems.map(v => {
            return this.injectorContext.get(v.classType, v.module);
        });
    }
}

export class PublicFilesystem extends Filesystem {
    constructor(publicDir: string, publicBaseUrl: string) {
        super(new FilesystemLocalAdapter({ root: publicDir }), {
            baseUrl: publicBaseUrl,
        });
    }
}

function send(
    response: HttpResponse,
    data: Uint8Array,
    name: string,
    options: ServeFilesystemOptions,
    mimeType?: string,
    lastModified?: Date,
) {
    if (options.cacheHeaders) {
        const cacheMaxAge = options.cacheMaxAge || 3600;
        response.setHeader('Cache-Control', 'max-age=' + cacheMaxAge);
        response.setHeader('Expires', new Date(Date.now() + cacheMaxAge * 1000).toUTCString());
        if (lastModified) {
            response.setHeader('Last-Modified', lastModified.toUTCString());
            response.setHeader('ETag', lastModified.getTime().toString());
        }
    }
    response.setHeader('Content-Disposition', 'inline; filename="' + name + '"');
    mimeType = mimeType || '';
    if (mimeType) response.setHeader('Content-Type', mimeType);
    response.setHeader('Content-Length', data.byteLength);
    response.end(data);
}

async function serveFile(
    filesystem: Filesystem,
    cache: FilesystemDataCache,
    file: FilesystemFile,
    response: HttpResponse,
    options: ServeFilesystemOptions,
) {
    const data = await cache.getData(filesystem, file.path);
    if (!data) {
        response.status(404);
        response.end('File not found');
        return;
    }
    send(response, data, file.name, options, '', file.lastModified);
}

export class ServeFilesystemOptions {
    baseUrl: string = '/';

    directory: string = '/';

    cacheHeaders: boolean = true;

    /**
     * Max cache control header age in seconds. Default is 1hour (3600 seconds).
     */
    cacheMaxAge: number = 3600;

    /**
     * Size of the memory cache in bytes. Default is 200MB.
     */
    dataCacheMaxSize: number = 200 * 1024 * 1024; // 200MB

    /**
     * Maximum number of files to cache in memory. Default is 10,000.
     */
    fileCacheMaxSize: number = 10000;

    /**
     * Maximum age of files in the file cache in seconds. Default is 15 minutes.
     */
    fileCacheMaxAge: number = 15 * 60;
}

class FilesystemDataCache {
    dataSize: number = 0;
    data = new Map<string, { created: number, size: number, promise: Promise<Uint8Array | undefined> }>;
    files = new Map<string, { created: number, promise: Promise<FilesystemFile | undefined> }>();

    constructor(private options: ServeFilesystemOptions) {
    }

    clear() {
        this.data.clear();
        this.files.clear();
        this.dataSize = 0;
    }

    ensureFileLimits() {
        if (this.files.size < this.options.fileCacheMaxSize) return;
        for (const [key, value] of this.files.entries()) {
            this.files.delete(key);
            if (this.files.size < this.options.fileCacheMaxSize) {
                break;
            }
        }
    }

    ensureDataLimits() {
        if (this.dataSize < this.options.dataCacheMaxSize) return;
        for (const [key, value] of this.data.entries()) {
            this.data.delete(key);
            this.dataSize -= value.size;
            if (this.dataSize < this.options.dataCacheMaxSize) {
                break;
            }
        }
    }

    getFile(filesystem: Filesystem, path: string): Promise<FilesystemFile | undefined> {
        this.ensureFileLimits();
        let cache = this.files.get(path);
        if (cache && cache.created + this.options.fileCacheMaxAge * 1000 > Date.now()) {
            return cache.promise;
        }
        cache = { created: Date.now(), promise: filesystem.getOrUndefined(path) };
        this.files.set(path, cache);
        return cache.promise;
    }

    getData(filesystem: Filesystem, path: string): Promise<Uint8Array | undefined> {
        this.ensureDataLimits();
        let cache = this.data.get(path);
        if (cache && cache.created + this.options.fileCacheMaxAge * 1000 > Date.now()) {
            return cache.promise;
        }
        const next = {
            created: Date.now(),
            size: 0,
            promise: filesystem.read(path).catch(() => undefined).then(data => {
                if (!data) return;
                next.size = data.byteLength;
                this.dataSize += data.byteLength;
                return data;
            }),
        };
        this.data.set(path, next);
        return next.promise;
    }
}

export function serveFilesystem<T extends Filesystem>(
    module: AppModule,
    options: Partial<ServeFilesystemOptions> = {},
    type?: ReceiveType<T>,
) {
    const resolved = Object.assign(new ServeFilesystemOptions(), options);
    resolved.baseUrl = pathNormalizeDirectory(resolved.baseUrl);
    resolved.directory = pathNormalizeDirectory(resolved.directory);
    const cache = new FilesystemDataCache(resolved);

    module.addListener(httpWorkflow.onRoute.listen(async (event, filesystem: InlineRuntimeType<typeof type, Filesystem>) => {
        const url = event.request.url || '/';
        if (!url.startsWith(resolved.baseUrl)) return;
        let path = url.substring(resolved.baseUrl.length) || '/';
        if (resolved.directory) path = pathJoin(resolved.directory, path);
        const file = await cache.getFile(filesystem, path);
        if (!file) return;
        event.routeFoundCallback(serveFile, [filesystem, cache, file, event.response, resolved]);
    }));
}
