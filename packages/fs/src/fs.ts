/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import {dirname, join} from 'path';
import {appendFile, ensureDir, pathExists, readFile, remove, stat, unlink, writeFile} from 'fs-extra';
import {AlreadyEncoded, DeepkitFile, FileMode, FileType, FilterQuery, StreamBehaviorSubject} from '@deepkit/framework-shared';
import {eachKey, eachPair, ProcessLocker} from '@deepkit/core';
import * as crypto from 'crypto';
import {Database} from '@deepkit/orm';
import {Exchange, inject, injectable, LiveDatabase} from '@deepkit/framework';
import {ClassSchema, jsonSerializer, t} from '@deepkit/type';

export type PartialFile = { id: string, path: string, mode: FileMode, md5?: string, version: number };

export function getMd5(content: string | Buffer): string {
    const buffer: Buffer = 'string' === typeof content ? new Buffer(content, 'utf8') : new Buffer(content);
    const md5 = crypto.createHash('md5').update(buffer).digest('hex');

    if (!md5) {
        throw new Error(`md5 is empty`);
    }

    return md5;
}

const FSCacheMessage = t.schema({
    id: t.string.optional,
    md5: t.string.optional,
});

@injectable()
export class FS<T extends DeepkitFile> {
    constructor(
        public readonly fileType: FileType<T>,
        private exchange: Exchange,
        private database: Database,
        private liveDatabase: LiveDatabase,
        private locker: ProcessLocker,
        @inject('fs.dir') private fileDir: string /* .deepkit/data/files/ */,
    ) {
    }

    public setFileDir(dir: string) {
        this.fileDir = dir;
    }

    public async removeAll(filter: FilterQuery<T>): Promise<boolean> {
        const files = await this.database.query(this.fileType.classSchema).filter(filter).find();
        return this.removeFiles(files);
    }

    public async remove(path: string, filter: FilterQuery<T> = {}): Promise<boolean> {
        const file = await this.findOne(path, filter);
        if (file) {
            return this.removeFile(file);
        }

        return false;
    }

    public async removeFile(file: T): Promise<boolean> {
        return this.removeFiles([file]);
    }

    public async removeFiles(files: T[]): Promise<boolean> {
        const md5ToCheckMap: { [k: string]: number } = {};
        const fileIds: string[] = [];

        for (const file of files) {
            if (file.md5) {
                //we need to check whether the file is used by others
                md5ToCheckMap[file.md5] = 0;
            } else {
                const split = this.getIdSplit(file.id);
                const localPath = join(this.fileDir, 'streaming', split);
                await remove(localPath);
            }

            fileIds.push(file.id);

            this.exchange.publishFile(file.id, {
                type: 'remove',
                path: file.path
            });
        }

        await this.database.query(this.fileType.classSchema).filter({
            $and: [{
                id: {$in: fileIds}
            }]
        } as FilterQuery<T>).deleteMany();

        //find which md5s are still linked
        const foundMd5s = await this.database.query(this.fileType.classSchema)
            .select('md5')
            .filter({md5: {$in: Object.keys(md5ToCheckMap)}} as FilterQuery<T>)
            .find();

        //iterate over still linked md5 files, and remove missing ones
        for (const row of foundMd5s) {
            if (row.md5) md5ToCheckMap[row.md5]++;
        }

        const deletes: Promise<any>[] = [];
        for (const [k, v] of eachPair(md5ToCheckMap)) {
            if (v === 0) {
                //no link for that md5 left, so delete file locally
                const localPath = this.getLocalPathForMd5(k);
                deletes.push(remove(localPath));
            }
        }

        //delete them parallel
        await Promise.all(deletes);

        return true;
    }

    public async ls(filter: FilterQuery<T>): Promise<T[]> {
        return await this.database.query(this.fileType.classSchema).filter(filter).find();
    }

    public async findOne(path: string, filter: FilterQuery<T> = {}): Promise<T | undefined> {
        return await this.database.query(this.fileType.classSchema).filter({path: path, ...filter} as T).findOneOrUndefined();
    }

    public async registerFile(md5: string, path: string, fields: Partial<T> = {}): Promise<T> {
        const file = await this.database.query(this.fileType.classSchema).filter({md5: md5} as T).findOneOrUndefined();

        if (!file) {
            throw new Error(`No file with '${md5}' found.`);
        }

        if (!file.md5) {
            throw new Error(`File ${file.id} has no md5 '${md5}'.`);
        }

        const localPath = this.getLocalPathForMd5(file.md5!);

        if (await pathExists(localPath)) {
            const newFile = this.fileType.fork(file, path);
            for (const i of eachKey(fields)) {
                (newFile as any)[i] = (fields as any)[i];
            }
            await this.database.persist(newFile);
            return newFile;
        } else {
            throw new Error(`File with md5 '${md5}' not found (content deleted).`);
        }
    }

    public async hasMd5InDb(md5: string): Promise<boolean> {
        return await this.database.query(this.fileType.classSchema).filter({md5} as FilterQuery<T>).has();
    }

    public async hasMd5(md5: string) {
        const file = await this.database.query(this.fileType.classSchema).filter({md5: md5} as FilterQuery<T>).findOneOrUndefined();

        if (file && file.md5) {
            const localPath = this.getLocalPathForMd5(md5);
            return await pathExists(localPath);
        }

        return false;
    }

    public async read(path: string, filter?: FilterQuery<T>): Promise<Buffer | undefined> {
        const file = await this.findOne(path, filter || {});
        // console.log('Read file ' + path, filter, file ? file.id : undefined);

        if (!file) {
            return;
        }

        return new Promise<Buffer>(async (resolve, reject) => {
            const localPath = this.getLocalPath(file);
            if (await pathExists(localPath)) {
                readFile(localPath, (err, data: Buffer) => {
                    if (err) {
                        reject(err);
                    }
                    resolve(data);
                });
            } else {
                resolve(undefined);
            }
        });
    }

    public getMd5Split(md5: string) {
        return md5.substr(0, 2) + '/' + md5.substr(2, 2) + '/' + md5.substr(4);
    }

    public getIdSplit(id: string) {
        return id.substr(0, 8) + '/' + id.substr(9, 9) + '/' + id.substr(19);
    }

    public getLocalPathForMd5(md5: string): string {
        if (!md5) {
            console.error('md5', md5);
            throw new Error('No md5 given.');
        }

        return join(this.fileDir, 'closed', this.getMd5Split(md5));
    }

    public getLocalPathForId(id: string): string {
        return join(this.fileDir, 'streaming', this.getIdSplit(id));
    }

    public getLocalPath(file: PartialFile) {
        if (file.mode === FileMode.closed) {
            if (!file.md5) {
                throw new Error(`Closed file has no md5 value: ${file.id} ${file.path}`);
            }
            return this.getLocalPathForMd5(file.md5);
        }

        if (!file.id) {
            throw new Error(`File has no id ${file.path}`);
        }

        return this.getLocalPathForId(file.id);
    }

    /**
     * Adds a new file or updates an existing one.
     */
    public async write(path: string, data: string | Buffer, fields: Partial<T> = {}): Promise<PartialFile> {
        let version = await this.exchange.version();
        const meta = await this.getFileMetaCache(path, fields);

        if ('string' === typeof data) {
            data = Buffer.from(data, 'utf8');
        }

        const newMd5 = getMd5(data);

        if (!meta.id) {
            const file = new this.fileType.classType(path);
            file.md5 = getMd5(data);
            for (const i of eachKey(fields)) {
                (file as any)[i] = (fields as any)[i];
            }
            file.size = data.byteLength;
            meta.id = file.id;
            version = 0;
            await this.database.persist(file);
        } else {
            //when md5 changes, it's important to move
            //the local file as well, since local path is based on md5.
            //when there is still an file with that md5 in the database, do not remove the old one.
            if (meta.md5 && meta.md5 !== newMd5) {
                await this.database.query(this.fileType.classSchema as any as ClassSchema<DeepkitFile>).filter({id: meta.id}).patchOne({md5: newMd5, size: data.byteLength});
                await this.refreshFileMetaCache(path, fields, meta.id, newMd5);

                //we need to check whether the local file needs to be removed
                if (!await this.hasMd5InDb(meta.md5)) {
                    //there's no db-file anymore linking using this local file, so remove it
                    const localPath = this.getLocalPathForMd5(meta.md5);
                    if (await pathExists(localPath)) {
                        try {
                            await unlink(localPath);
                        } catch (e) {
                            //Race condition could happen, but we don't care really.
                        }
                    }
                }
            }
        }

        const localPath = this.getLocalPathForMd5(newMd5);
        const localDir = dirname(localPath);
        await ensureDir(localDir);

        const lock = await this.locker.acquireLock('file:' + path);
        try {
            await writeFile(localPath, data);

            this.exchange.publishFile(meta.id, {
                type: 'set',
                version: version,
                path: path,
            });
        } finally {
            await lock.unlock();
        }

        return {
            id: meta.id!,
            mode: FileMode.closed,
            path: path,
            version: version,
            md5: newMd5
        };
    }

    public async refreshFileMetaCache(path: string, fields: Partial<T> = {}, id: string, md5?: string) {
        const filter = {path, ...fields};
        const cacheKey = JSON.stringify(jsonSerializer.for(this.fileType.classSchema).partialSerialize(filter));

        await this.exchange.set('file-meta/' + cacheKey, FSCacheMessage, {id, md5});
    }

    public async getFileMetaCache(path: string, fields: Partial<T> = {}): Promise<{ id?: string, md5?: string }> {
        const filter = {path, ...fields};
        const cacheKey = JSON.stringify(jsonSerializer.for(this.fileType.classSchema).partialSerialize(filter));

        const fromCache = await this.exchange.get('file-meta/' + cacheKey, FSCacheMessage);
        if (fromCache) return fromCache;

        const item = await this.database.query(this.fileType.classSchema).filter({path, ...fields}).findOneOrUndefined();
        if (item) {
            await this.refreshFileMetaCache(path, fields, item.id, item.md5);
            return {id: item.id, md5: item.md5};
        }

        return {};
    }

    /**
     * Streams content by always appending data to the file's content and publishes the data to the exchange change feed.
     */
    public async stream(
        path: string,
        data: Buffer,
        fields: Partial<T> = {},
        options: {
            cropSizeAt?: number
            cropSizeAtTo?: number
        } = {}
    ) {
        const lock = await this.locker.acquireLock('file:' + path);
        let version = await this.exchange.version();
        const meta = await this.getFileMetaCache(path, fields);

        try {
            let file: T | undefined;

            if (!meta.id) {
                file = new this.fileType.classType(path);
                for (const i of eachKey(fields)) {
                    (file as any)[i] = (fields as any)[i];
                }
                file!.mode = FileMode.streaming;
                meta.id = file!.id;
                version = 0;
            }

            const localPath = this.getLocalPathForId(meta.id!);

            const localDir = dirname(localPath);
            if (!await pathExists(localDir)) {
                await ensureDir(localDir);
            }

            await appendFile(localPath, data);
            const stats = await stat(localPath);

            if (options.cropSizeAt && options.cropSizeAtTo && stats.size > options.cropSizeAt) {
                if (options.cropSizeAtTo >= options.cropSizeAt) {
                    throw new Error('cropSizeAtTo is not allowed to be bigger than cropSizeAt.');
                }
                const content = await readFile(localPath);
                await writeFile(localPath, content.slice(stats.size - options.cropSizeAtTo));
            }

            if (file) {
                //when a subscribes is listening to this file,
                //we publish this only when the file is written to disk.
                await this.database.persist(file);
                this.refreshFileMetaCache(path, fields, meta.id!, undefined).catch(console.error);
            }

            await this.exchange.publishFile(meta.id!, {
                type: 'append',
                version: version,
                path: path,
                size: stats.size,
                content: data.toString('base64'),
            });
        } finally {
            await lock.unlock();
        }
    }

    public async subscribe(path: string, fields: Partial<T> = {}): Promise<StreamBehaviorSubject<Uint8Array | undefined>> {
        const subject = new StreamBehaviorSubject<any>(undefined);

        const file = await this.findOne(path, fields);

        const streamContent = async (id: string | number) => {
            //it's important to stop writing/appending when we read initially the file
            //and then subscribe, otherwise we are hit by a race condition where it can happen
            //that we get older subscribeFile messages
            const lock = await this.locker.acquireLock('file:' + path);

            try {
                //read initial content
                const data = await this.read(path, fields);

                if (subject.isStopped) {
                    return;
                }

                subject.next(data);

                //it's important that this callback is called right after we returned the subject,
                //and subscribed to the subject, otherwise append won't work correctly and might be hit by a race-condition.
                const exchangeSubscription = await this.exchange.subscribeFile(id, async (message) => {
                    if (message.type === 'set') {
                        const data = await this.read(path, fields);
                        subject.next(data);
                    } else if (message.type === 'append') {
                        //message.size contains the new size after this append has been applied.
                        //this means we could track to avoid race conditions, but for the moment we use a lock.
                        //lock is acquired in stream() and makes sure we don't get file appends during
                        //reading and subscribing
                        //ConnectionMiddleware converts AlreadyEncoded correct: Meaning it doesnt touch it
                        subject.append(new AlreadyEncoded('Uint8Array', message.content) as any);
                    } else if (message.type === 'remove') {
                        subject.next(undefined);
                    }
                });

                subject.addTearDown(() => {
                    if (exchangeSubscription) {
                        exchangeSubscription.unsubscribe();
                    }
                });

            } finally {
                await lock.unlock();
            }
        };

        if (file) {
            await streamContent(file.id);
        } else {
            subject.next(undefined);

            const sub = this.liveDatabase.query(this.fileType.classSchema).filter({
                path: path,
                ...fields
            }).onCreation().subscribe((id) => {
                if (!subject.isStopped) {
                    streamContent(id);
                }
            });

            subject.addTearDown(() => {
                if (sub) sub.unsubscribe();
            });
        }

        return subject;
    }
}
