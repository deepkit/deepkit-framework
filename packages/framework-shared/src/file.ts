import {IdInterface} from "./contract";
import {Entity, f, uuid} from "@super-hornet/marshal";
import {ClassType, eachKey} from "@super-hornet/core";

export enum FileMode {
    closed,
    streaming,
}

@Entity('file', 'files')
export class HornetFile implements IdInterface {
    @f.primary().uuid()
    id: string = uuid();

    @f
    version: number = 0;

    @f.enum(FileMode)
    mode: FileMode = FileMode.closed;

    @f.index()
    md5?: string; //undefined in case of file is in mode=streaming

    @f
    size: number = 0;

    @f
    created: Date = new Date();

    @f
    updated: Date = new Date();

    constructor(
        /**
         * Path WITHOUT starting slash /;
         * e.g.
         *
         *    model.py
         *    .deepkit/log/master.txt
         */
        @f.asName('path').index()
        public path: string,
    ) {
        if (undefined === this.path) {
            throw new Error('new GlutFile undefined path.');
        }
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

export class FileType<T extends HornetFile> {
    constructor(public readonly classType: ClassType<T>) {}

    static forDefault() {
        return new FileType(HornetFile);
    }

    static forCustomType<T extends HornetFile>(classType: ClassType<T>) {
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
