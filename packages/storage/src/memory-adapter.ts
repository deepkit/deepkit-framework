import { StorageFileNotFound, FileType, pathDirectories, pathDirectory, Reporter, StorageAdapter, StorageFile } from './storage.js';

export class StorageMemoryAdapter implements StorageAdapter {
    protected memory: { file: StorageFile, contents: Uint8Array }[] = [];

    async files(path: string): Promise<StorageFile[]> {
        return this.memory.filter(file => file.file.directory === path)
            .map(v => v.file);
    }

    async makeDirectory(path: string): Promise<void> {
        const directories = pathDirectories(path);
        //filter out all parts that already exist
        for (const dir of directories) {
            const exists = await this.exists(dir);
            if (exists) continue;
            const file = new StorageFile(dir);
            file.type = FileType.Directory;
            this.memory.push({ file, contents: new Uint8Array });
        }
    }

    async allFiles(path: string): Promise<StorageFile[]> {
        return this.memory.filter(file => file.file.inDirectory(path))
            .map(v => v.file);
    }

    async directories(path: string): Promise<StorageFile[]> {
        return this.memory.filter(file => file.file.directory === path)
            .filter(file => file.file.isDirectory())
            .map(v => v.file);
    }

    async allDirectories(path: string): Promise<StorageFile[]> {
        return this.memory.filter(file => file.file.inDirectory(path))
            .filter(file => file.file.isDirectory())
            .map(v => v.file);
    }

    async write(path: string, contents: Uint8Array, reporter: Reporter): Promise<void> {
        let file = this.memory.find(file => file.file.path === path);
        if (!file) {
            await this.makeDirectory(pathDirectory(path));
            file = { file: new StorageFile(path), contents };
            this.memory.push(file);
        }
        file.contents = contents;
        file.file.size = contents.length;
        file.file.lastModified = new Date();
    }

    async read(path: string, reporter: Reporter): Promise<Uint8Array> {
        const file = this.memory.find(file => file.file.path === path);
        if (!file) throw new StorageFileNotFound('File not found');
        return file.contents;
    }

    async exists(path: string): Promise<boolean> {
        return !!this.memory.find(file => file.file.path === path);
    }

    async delete(path: string): Promise<void> {
        const index = this.memory.findIndex(file => file.file.path === path);
        if (index === -1) throw new StorageFileNotFound('File not found');
        this.memory.splice(index, 1);
    }

    async deleteDirectory(path: string, reporter: Reporter): Promise<void> {
        const files = this.memory.filter(file => file.file.path.startsWith(path));
        reporter.progress(0, files.length);
        let i = 0;
        for (const file of files) {
            this.memory.splice(this.memory.indexOf(file), 1);
            reporter.progress(++i, files.length);
        }
    }

    async get(path: string): Promise<StorageFile | undefined> {
        return this.memory.find(file => file.file.path === path)?.file;
    }

    async copy(source: string, destination: string, reporter: Reporter): Promise<void> {
        const files = this.memory.filter(file => file.file.path.startsWith(source));
        reporter.progress(0, files.length);
        let i = 0;
        for (const file of files) {
            const newPath = destination + file.file.path.slice(source.length);
            this.memory.push({ file: new StorageFile(newPath), contents: file.contents });
            reporter.progress(++i, files.length);
        }
    }

    async move(source: string, destination: string, reporter: Reporter): Promise<void> {
        const files = this.memory.filter(file => file.file.path.startsWith(source));
        reporter.progress(0, files.length);
        let i = 0;
        for (const file of files) {
            const newPath = destination + file.file.path.slice(source.length);
            file.file.path = newPath;
            reporter.progress(++i, files.length);
        }
    }
}
