import {IdInterface} from "./contract";
import {Entity, EnumField, uuid, IDField, UUIDField, Field} from "@marcj/marshal";
import {ClassType, eachKey} from "@marcj/estdlib";

export enum FileMode {
    closed,
    streaming,
}

@Entity('file', 'files')
export class GlutFile implements IdInterface {
    @IDField()
    @UUIDField()
    id: string = uuid();

    @Field()
    version: number = 0;

    /**
     * Path WITHOUT starting slash /;
     * e.g.
     *
     *    model.py
     *    .deepkit/log/master.txt
     */
    @Field()
    path: string;

    @EnumField(FileMode)
    mode: FileMode = FileMode.closed;

    @Field()
    md5?: string; //undefined in case of file is in mode=streaming

    @Field()
    size: number = 0;

    @Field()
    created: Date = new Date();

    @Field()
    updated: Date = new Date();

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

export class FileType<T extends GlutFile> {
    constructor(public readonly classType: ClassType<T>) {}

    static forDefault() {
        return new FileType(GlutFile);
    }

    static forCustomType<T extends GlutFile>(classType: ClassType<T>) {
        return new FileType(classType);
    }

    public fork(file: T, newPath: string): T {
        const newFile = new this.classType(newPath);

        for (const i of eachKey(file)) {
            (newFile as any)[i] = (file as any)[i];
        }

        newFile.path = newPath;
        newFile.version = 0;
        newFile.created = new Date;
        newFile.updated = new Date;
        newFile.id = uuid();

        return newFile;
    }
}
