import {IdInterface} from "./contract";
import {AnyType, DateType, Entity, EnumType, ID, NumberType, StringType, uuid, UUIDType} from "@marcj/marshal";

export interface FileContext {
    [name: string]: any;
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
    meta?: { [k: string]: any } = {};

    constructor(path: string) {
        this.path = path;
        if (this.path.substr(0, 1) === '/') {
            this.path = this.path.substr(1);
        }
    }

    public getMd5(): string {
        if (!this.md5) {
            throw new Error('File is in streaming mode and has no md5.');
        }

        return this.md5;
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

    /**
     * Returns always leading slash and trailing slash.
     */
    public getDirectory(): string {
        const fullPath = '/' + this.path;

        return fullPath.substr(0, fullPath.lastIndexOf('/') + 1);
    }

    /**
     * Name without slashes.
     */
    public getDirectoryName(): string {
        const fullPath = '/' + this.path;
        const dirPath = fullPath.substr(0, fullPath.lastIndexOf('/'));

        return dirPath.substr(dirPath.lastIndexOf('/') + 1);
    }

    /**
     * Checks whether this file is in given directory.
     *
     * @param dir with leading slash and trailing slash. Same as getDirectory().
     */
    public inDirectory(dir: string = '/'): boolean {
        return this.getDirectory() === dir;
    }
}
