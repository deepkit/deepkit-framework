import {dirname, join} from "path";
import {appendFile, ensureDir, pathExists, readFile, remove, unlink, writeFile} from "fs-extra";
import {Exchange} from "./exchange";
import {uuid4Binary} from "@marcj/marshal-mongo";
import {Binary} from "bson";
import {ExchangeDatabase} from "./exchange-database";
import {AnyType, DateType, Entity, EnumType, ID, NumberType, StringType, uuid, UUIDType} from "@marcj/marshal";
import {IdInterface} from "@kamille/core";
import {eachPair} from "@kamille/core/src/iterator";
import * as crypto from "crypto";

export function getMd5(content: string | Buffer): string {
    const buffer: Buffer = 'string' === typeof content ? new Buffer(content, 'utf8') : new Buffer(content);
    const md5 = crypto.createHash('md5').update(buffer).digest('hex');

    if (!md5) {
        throw new Error(`md5 is empty`);
    }

    return md5;
}

export enum FileMode {
    closed,
    streaming,
}

@Entity('file', 'files')
export class File implements IdInterface {
    @ID()
    @UUIDType()
    id: string = uuid();

    @NumberType()
    version: number = 0;

    /**
     * Path WITHOUT starting slash /;
     * e.g.
     *
     *    model.py
     *    .deepkit/log/master.txt
     */
    @StringType()
    path: string;

    @EnumType(FileMode)
    mode: FileMode = FileMode.closed;

    @StringType()
    md5?: string; //undefined in case of file is in mode=streaming

    @NumberType()
    size: number = 0;

    @DateType()
    created: Date = new Date();

    @DateType()
    updated: Date = new Date();

    @AnyType()
    meta?: {[k: string]: any} = {};

    constructor(path: string) {
        this.path = path;
    }

    public fork(newPath: string): File {
        const newFile = new File(newPath);
        newFile.size = this.size;
        newFile.version = 0;
        newFile.id = uuid();
        newFile.mode = this.mode;
        newFile.md5 = this.md5;
        newFile.created = new Date;
        newFile.updated = new Date;

        return newFile;
    }

    public getFullPath(): string {
        return '/' + this.path;
    }

    public getName(): string {
        const fullPath = '/' + this.path;

        return fullPath.substr(fullPath.lastIndexOf('/') + 1);
    }

    public getDirectory(): string {
        const fullPath = '/' + this.path;

        return fullPath.substr(0, fullPath.lastIndexOf('/') + 1);
    }

    public getDirectoryName(): string {
        const fullPath = '/' + this.path;
        const dirPath = fullPath.substr(0, fullPath.lastIndexOf('/'));

        return dirPath.substr(dirPath.lastIndexOf('/') + 1);
    }

    public getDirectoryIn(dir: string = '/'): string {
        const fullPath = '/' + this.path;

        if (fullPath === dir) {
            return '';
        }

        const rPath = fullPath.substr(dir.length);

        console.log('getDirectoryIn', fullPath, dir, rPath, '----', rPath.substr(0, rPath.indexOf('/')));
        return rPath.substr(0, rPath.indexOf('/'));
    }

    public inDirectory(dir: string = '/') {
        return this.getDirectory() === dir;
    }
}


export interface FileMetaData {
    [k: string]: any;
}

export class FS {
    constructor(
        private exchange: Exchange,
        private database: ExchangeDatabase,
        private fileDir: string /* .deepkit/data/files/ */,
    ) {
    }

    public setFileDir(dir: string) {
        this.fileDir = dir;
    }

    public async removeAll(metaData?: FileMetaData): Promise<boolean> {
        const files = await this.database.find(File, metaData || {});
        return this.removeFiles(files);
    }

    public async remove(path: string, metaData?: FileMetaData): Promise<boolean> {
        const file = await this.findOne(path);
        if (file) {
            return this.removeFile(file);
        }

        return false;
    }

    public async removeFile(file: File): Promise<boolean> {
        return this.removeFiles([file]);
    }

    public async removeFiles(files: File[]): Promise<boolean> {
        const md5ToCheckMap: { [k: string]: number } = {};
        const fileIds: Binary[] = [];

        for (const file of files) {
            if (file.md5) {
                //we need to check whether the file is used by others
                md5ToCheckMap[file.md5] = 0;
            } else {
                const split = this.getIdSplit(file.id);
                const localPath = join(this.fileDir, 'streaming', split);
                await remove(localPath);
            }

            fileIds.push(uuid4Binary(file.id));

            this.exchange.publishFile({
                type: 'remove',
                path: file.path,
                meta: file.meta,
            });
        }

        await this.database.deleteMany(File, {
            $and: [{
                id: {$in: fileIds}
            }]
        });

        //found which md5s are still linked
        const fileCollection = await this.database.collection(File);
        const foundMd5s = await fileCollection.find({
            md5: {$in: Object.keys(md5ToCheckMap)}
        }, {
            projection: {md5: 1}
        }).toArray();

        //iterate over still linked md5 files, and remove missing ones
        for (const row of foundMd5s) {
            if (row.md5) {
                md5ToCheckMap[row.md5]++;
            }
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

    public async ls(metaData?: FileMetaData): Promise<File[]> {
        return await this.database.find(File, metaData || {});
    }

    public async findOne(path: string, metaData?: FileMetaData): Promise<File | null> {
        return await this.database.get(File, {...metaData, path});
    }

    public async registerFile(md5: string, path: string, metaData?: FileMetaData) {
        const file = await this.database.get(File, {md5: md5});

        if (!file || !file.md5) {
            throw new Error(`File with md5 '${md5}' not found.`);
        }

        const localPath = this.getLocalPathForMd5(file.md5);

        if (await pathExists(localPath)) {
            const newFile = file.fork(path);
            newFile.meta = metaData;
            await this.database.add(File, newFile);
            console.log('file added', newFile.id);
        } else {
            throw new Error(`File with md5 '${md5}' not found (content deleted).`);
        }
    }

    public async hasMd5InDb(md5: string): Promise<boolean> {
        const collection = await this.database.collection(File);
        return 0 < await collection.countDocuments({md5: md5});
    }

    public async hasMd5(md5: string) {
        const file = await this.database.get(File, {md5: md5});

        if (file && file.md5) {
            const localPath = this.getLocalPathForMd5(md5);
            return await pathExists(localPath);
        }

        return false;
    }

    public async read(path: string, metaData?: FileMetaData): Promise<Buffer | undefined> {
        // const mongo = this.database.mongoPool.get(accountId);
        // const connection = await mongo.connect();

        // console.time('Read file ' + path);
        // // console.time('collection file ' + path);
        // const files = connection.db('account_' + accountId).collection('files');
        // // console.timeEnd('collection file ' + path);
        // // console.time('Read file ' + path);
        // const row = await files.findOne(partialClassToMongo(File, {job: metaData.job, path: path}));
        // // console.timeEnd('Read file ' + path);
        // // console.time('Transform file ' + path);
        // const file = mongoToClass(File, row);
        // // console.timeEnd('Transform file ' + path);
        // console.timeEnd('Read file ' + path);

        const file = await this.findOne(path, metaData);
        console.log('Read file ' + path, metaData, file ? file.id : undefined);

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
                    // console.log('Read file content', data);
                    resolve(data);
                });
            } else {
                console.log('path does not exist', localPath);
                resolve();
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
        return join(this.fileDir, 'closed', this.getMd5Split(md5));
    }

    public getLocalPath(file: File) {
        if (file.mode === FileMode.closed) {
            if (!file.md5) {
                throw new Error(`Closed file has no md5 value: ${file.id} ${file.path}`);
            }
            return this.getLocalPathForMd5(file.md5);
        }

        if (!file.id) {
            throw new Error(`File has no id ${file.path}`);
        }

        return join(this.fileDir, 'streaming', this.getIdSplit(file.id));
    }

    public async write(path: string, data: Buffer, metaData?: FileMetaData): Promise<File> {
        let file = await this.findOne(path, metaData);

        if (file && !file.id) {
            throw new Error(`File has no id ${path} from DB`);
        }

        const md5 = getMd5(data);

        if (!file) {
            file = new File(path);
            file.meta = metaData;
            file.md5 = getMd5(data);
            file.size = data.byteLength;
            await this.database.add(File, file);
        } else {
            if (file.md5 && file.md5 !== md5) {
                const oldMd5 = file.md5;

                file.md5 = md5;
                file.size = data.byteLength;

                await this.database.patch(File, file.id, {md5: file.md5, size: file.size});

                //we need to check whether the local file needs to be removed
                if (!await this.hasMd5InDb(oldMd5)) {
                    //there's no db-file anymore linking using this local file, so remove it
                    const localPath = this.getLocalPathForMd5(oldMd5);
                    if (await pathExists(localPath)) {
                        await unlink(localPath);
                    }
                }
            }
        }

        const localPath = this.getLocalPath(file);
        const localDir = dirname(localPath);
        await ensureDir(localDir);
        await writeFile(localPath, data);

        this.exchange.publishFile({
            type: 'set',
            path: path,
            meta: file.meta,
            content: data.toString('utf8')
        });

        return file;
    }

    /**
     * Streams content by always appending data to the file's content.
     */
    public async stream(path: string, data: Buffer, metaData?: FileMetaData) {
        let file = await this.findOne(path, metaData);

        if (!file) {
            file = new File(path);
            file.mode = FileMode.streaming;
            file.meta = metaData;
            await this.database.add(File, file);
        }

        const localPath = this.getLocalPath(file);
        const localDir = dirname(localPath);
        await ensureDir(localDir);

        await appendFile(localPath, data);

        this.exchange.publishFile({
            type: 'append',
            path: path,
            meta: file.meta,
            content: data.toString(),
        });

    }
}
