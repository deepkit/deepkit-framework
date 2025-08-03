import { FilesystemAdapter, FilesystemError, FilesystemFile, FileType, FileVisibility, Reporter } from '@deepkit/filesystem';
import { ClassType, escapeRegExp, pathDirectory } from '@deepkit/core';
import { Database, DatabaseSession } from '@deepkit/orm';
import { entity, Index, PrimaryKey } from '@deepkit/type';

export interface FilesystemModel {
    path: string;
    dir: string;
    type: FileType;
    size: number;
    created: Date;
    visibility: FileVisibility;
    lastModified?: Date;
}

export interface FileDataModel {
    path: string;
    data: Uint8Array;
}

@(entity.name('file'))
export class FileEntity implements FilesystemModel {
    path: string & PrimaryKey = '';
    dir: string & Index = '/';
    type: FileType = 'file';
    size: number = 0;
    created: Date = new Date();
    visibility: FileVisibility = 'public';
    lastModified?: Date;
}

@(entity.name('file_data'))
export class FileDataEntity {
    path: string & PrimaryKey = '';
    data: Uint8Array = new Uint8Array();
}

export function mapFileEntityToFilesystemFile(file: FilesystemModel): FilesystemFile {
    const filesystemFile = new FilesystemFile(file.path, file.type);
    filesystemFile.size = file.size;
    // filesystemFile.created = file.created;
    filesystemFile.visibility = file.visibility;
    filesystemFile.lastModified = file.lastModified;
    return filesystemFile;
}

export interface FilesystemOrmOptions {
    database: Database;
    entityClass?: ClassType<FilesystemModel>;
    entityDataClass?: ClassType<FileDataModel>;
    transactional?: boolean;
}

function getParents(path: string): string[] {
    const parents: string[] = [path];
    let current = pathDirectory(path);
    while (current !== '/') {
        parents.push(current);
        current = pathDirectory(current);
    }
    return parents;
}

function childrenFilter(path: string) {
    if (path === '/') return { path: { $regex: '^/' } } as const;
    return { path: { $regex: `^${escapeRegExp(path)}/` } } as const;
}

export class FilesystemDatabaseAdapter implements FilesystemAdapter {
    database: Database;
    entityClass: ClassType<FilesystemModel>;
    entityDataClass: ClassType<FileDataModel>;
    transactional: boolean;

    constructor(options: FilesystemOrmOptions) {
        this.database = options.database;
        this.entityClass = options.entityClass || FileEntity;
        this.entityDataClass = options.entityDataClass || FileDataEntity;
        this.transactional = options.transactional ?? false;
    }

    supportsVisibility() {
        return true;
    }

    supportsDirectory() {
        return true;
    }

    async close(): Promise<void> {

    }

    async makeDirectory(path: string, visibility: FileVisibility, session?: DatabaseSession): Promise<void> {
        const parents = getParents(path);

        const existingSession = !!session;
        if (!session) {
            session = this.database.createSession();
            if (this.transactional) session.useTransaction();
        }

        try {
            for (const parent of parents) {
                if (parent === '/') continue;
                const exists = await this.database.query(this.entityClass)
                    .filter({ path: parent })
                    .has();

                if (exists) return;
                const file = new this.entityClass();
                file.path = path;
                file.type = 'directory';
                file.size = 0;
                file.created = new Date;
                file.lastModified = new Date;
                file.visibility = visibility;
                file.dir = pathDirectory(path);
                session.add(file);
            }
            if (existingSession) {
                await session.flush();
            } else {
                await session.commit();
            }
        } catch (error) {
            if (!existingSession && this.transactional) await session.rollback();
            throw error;
        }
    }

    async setVisibility(path: string, visibility: FileVisibility): Promise<void> {
        await this.database.query(this.entityClass).filter({ path }).patchOne({ visibility });
    }

    async getVisibility(path: string): Promise<FileVisibility> {
        const file = await this.get(path);
        if (!file) throw new Error(`File ${path} not found`);
        return file.visibility;
    }

    async files(path: string): Promise<FilesystemFile[]> {
        return await this.getFiles(path);
    }

    protected async getFiles(path: string): Promise<FilesystemFile[]> {
        const files = await this.database.query(this.entityClass)
            .filter({ dir: path })
            .find();
        return files.map(file => mapFileEntityToFilesystemFile(file));
    }

    async delete(paths: string[]): Promise<void> {
        const session = this.database.createSession();
        if (this.transactional) session.useTransaction();
        try {
            for (const path of paths) {
                const file = await this.get(path);
                if (!file) throw new FilesystemError(`File ${path} not found`);
                if (file.type === 'directory') {
                    throw new FilesystemError(`Cannot delete directory ${path}`);
                }
                await session.query(this.entityClass).filter({ path }).deleteOne();
                await session.query(this.entityDataClass).filter({ path }).deleteOne();
            }
            await session.commit();
        } catch (error) {
            if (this.transactional) await session.rollback();
            throw error;
        }
    }

    async deleteDirectory(path: string, reporter: Reporter): Promise<void> {
        const session = this.database.createSession();
        if (this.transactional) session.useTransaction();

        try {
            if (path !== '/') {
                const file = await session.query(this.entityClass)
                    .filter({ path })
                    .findOneOrUndefined();

                if (!file) throw new FilesystemError(`File ${path} not found`);
                if (file.type !== 'directory') throw new FilesystemError(`Cannot delete file ${path} as directory`);
                session.remove(file);
            }

            const files = await session.query(this.entityClass)
                .filter(childrenFilter(path))
                .find();
            reporter.progress(0, files.length);

            const batchSize = 100;
            for (let i = 0; i < files.length; i += batchSize) {
                const batch = files.slice(i, i + batchSize);
                const paths = batch.map(file => file.path);
                await session.query(this.entityClass).filter({ path: { $in: paths } }).deleteMany();
                await session.query(this.entityDataClass).filter({ path: { $in: paths } }).deleteMany();
                await session.flush();
                reporter.progress(i + batch.length, files.length);
                if (reporter.aborted) break;
            }
            await session.commit();
        } catch (error) {
            if (this.transactional) await session.rollback();
            throw error;
        }
    }

    async exists(paths: string[]): Promise<boolean> {
        const files = await this.database.query(this.entityClass)
            .filter({ path: { $in: paths } })
            .select('path')
            .find();
        return files.length === paths.length;
    }

    async get(path: string): Promise<FilesystemFile | undefined> {
        if (path === '/') return new FilesystemFile('/', 'directory');

        const record = await this.database.query(this.entityClass)
            .filter({ path: path })
            .findOneOrUndefined();
        return record && mapFileEntityToFilesystemFile(record);
    }

    // async move(source: string, destination: string, reporter: Reporter): Promise<void> {
    //     await this.client.rename(this.getRemotePath(source), this.getRemotePath(destination));
    // }

    async moveFile(source: string, destination: string): Promise<void> {
        const session = this.database.createSession();
        if (this.transactional) session.useTransaction();
        try {
            const res = await session.query(this.entityClass)
                .filter({ path: source })
                .patchOne({ path: destination, dir: pathDirectory(destination), lastModified: new Date() });
            if (res.modified === 0) throw new FilesystemError(`File ${source} not found`);
            await session.query(this.entityDataClass)
                .filter({ path: source })
                .patchOne({ path: destination });
            await session.commit();
        } catch (error) {
            if (this.transactional) await session.rollback();
            throw error;
        }
    }

    async read(path: string, reporter: Reporter): Promise<Uint8Array> {
        const session = this.database.createSession();
        if (this.transactional) session.useTransaction();
        const file = await session.query(this.entityClass)
            .filter({ path })
            .findOneOrUndefined();
        if (!file) throw new FilesystemError(`File ${path} not found`);
        if (file.type !== 'file') throw new FilesystemError(`Cannot read directory ${path}`);
        const data = await session.query(this.entityDataClass)
            .filter({ path })
            .findOneOrUndefined();
        if (!data) throw new FilesystemError(`File data for ${path} not found`);
        return data.data;
    }

    async write(path: string, contents: Uint8Array, visibility: FileVisibility, reporter: Reporter): Promise<void> {
        const session = this.database.createSession();
        if (this.transactional) session.useTransaction();
        try {
            await this.makeDirectory(pathDirectory(path), visibility, session);
            let file = await session.query(this.entityClass)
                .filter({ path })
                .findOneOrUndefined();
            if (!file) {
                file = new this.entityClass();
                file.path = path;
                file.type = 'file';
                file.created = new Date();
                file.lastModified = new Date();
                file.visibility = visibility;
                file.dir = pathDirectory(path);
                session.add(file);
            }

            file.size = contents.length;
            file.lastModified = new Date();
            file.visibility = visibility;
            let data = await session.query(this.entityDataClass)
                .filter({ path })
                .findOneOrUndefined();
            if (!data) {
                data = new this.entityDataClass();
                data.path = path;
                session.add(data);
            }
            data.data = contents;
            await session.commit();
        } catch (error) {
            if (this.transactional) await session.rollback();
            throw error;
        }
    }
}
