import { expect, test } from '@jest/globals';
import { FileType, pathDirectories, Storage, StorageAdapter, StorageFile } from '../src/storage.js';
import { StorageMemoryAdapter } from '../src/memory-adapter.js';

export let adapterFactory: () => Promise<StorageAdapter> = async () => new StorageMemoryAdapter;

export function setAdapterFactory(factory: () => Promise<StorageAdapter>) {
    adapterFactory = factory;
}

test('utils', async () => {
    expect(pathDirectories('/')).toEqual([]);
    expect(pathDirectories('/folder')).toEqual(['/folder']);
    expect(pathDirectories('/folder/')).toEqual(['/folder']);
    expect(pathDirectories('/folder/folder2')).toEqual(['/folder', '/folder/folder2']);
});

test('file API', async () => {
    {
        const file = new StorageFile('/file.txt');
        expect(file.path).toBe('/file.txt');
        expect(file.name).toBe('file.txt');
        expect(file.directory).toBe('/');
        expect(file.size).toBe(undefined);
        expect(file.extension).toBe('txt');
        expect(file.lastModified).toBe(undefined);
        expect(file.isFile()).toBe(true);
        expect(file.isDirectory()).toBe(false);
        expect(file.inDirectory('/')).toBe(true);
        expect(file.inDirectory('/folder')).toBe(false);
        expect(file.inDirectory('/file.txt')).toBe(false);
        expect(file.inDirectory('/file.txt/')).toBe(false);
        expect(file.inDirectory('/file.txt/abc')).toBe(false);
    }

    {
        const file = new StorageFile('/folder/file.txt');
        expect(file.path).toBe('/folder/file.txt');
        expect(file.name).toBe('file.txt');
        expect(file.directory).toBe('/folder');
        expect(file.size).toBe(undefined);
        expect(file.extension).toBe('txt');
        expect(file.lastModified).toBe(undefined);
        expect(file.isFile()).toBe(true);
        expect(file.isDirectory()).toBe(false);

        expect(file.inDirectory('/')).toBe(true);
        expect(file.inDirectory('/folder')).toBe(true);
        expect(file.inDirectory('/folder/')).toBe(true);
        expect(file.inDirectory('/folder/file.txt')).toBe(false);
        expect(file.inDirectory('/folder/file.txt/')).toBe(false);
        expect(file.inDirectory('/folder/file.txt/abc')).toBe(false);
    }

    {
        const file = new StorageFile('/folder/folder2/file.txt');
        expect(file.path).toBe('/folder/folder2/file.txt');
        expect(file.name).toBe('file.txt');
        expect(file.directory).toBe('/folder/folder2');

        expect(file.inDirectory('/')).toBe(true);
        expect(file.inDirectory('/folder')).toBe(true);
        expect(file.inDirectory('/folder/folder2')).toBe(true);
        expect(file.inDirectory('/folder/folder2/')).toBe(true);
        expect(file.inDirectory('/folder/folder')).toBe(false);
        expect(file.inDirectory('/folder/folder/')).toBe(false);
    }

    {
        const file = new StorageFile('/folder');
        file.type = FileType.Directory;
        expect(file.path).toBe('/folder');
        expect(file.name).toBe('folder');
        expect(file.directory).toBe('/');
        expect(file.size).toBe(undefined);
        expect(file.extension).toBe('');
        expect(file.lastModified).toBe(undefined);
        expect(file.isFile()).toBe(false);
        expect(file.isDirectory()).toBe(true);
        expect(file.inDirectory('/')).toBe(true);
        expect(file.inDirectory('/folder')).toBe(false);
        expect(file.inDirectory('/another/folder')).toBe(false);
    }
});

test('basic', async () => {
    const storage = new Storage(await adapterFactory());

    const files = await storage.files('/');
    expect(files).toEqual([]);

    await storage.write('/file1.txt', 'contents1');
    await storage.write('/file2.txt', 'contents2');
    await storage.write('/file3.txt', 'abc');

    const files2 = await storage.files('/');
    expect(files2).toMatchObject([
        { path: '/file1.txt', size: 9, lastModified: expect.any(Date) },
        { path: '/file2.txt', size: 9, lastModified: expect.any(Date) },
        { path: '/file3.txt', size: 3, lastModified: expect.any(Date) },
    ]);

    const content = await storage.readAsText('/file1.txt');
    expect(content).toBe('contents1');

    const file = await storage.get('/file1.txt');
    expect(file).toMatchObject({ path: '/file1.txt', size: 9, lastModified: expect.any(Date) });

    await expect(() => storage.get('/file4.txt')).rejects.toThrowError('File not found');
    expect(await storage.getOrUndefined('/file4.txt')).toBe(undefined);

    expect(await storage.exists('/file1.txt')).toBe(true);
    expect(await storage.exists('/file2.txt')).toBe(true);
    expect(await storage.exists('/file3.txt')).toBe(true);
    expect(await storage.exists('//file3.txt')).toBe(true);
    expect(await storage.exists('/file3.txt/')).toBe(true);
    expect(await storage.exists('//file3.txt/')).toBe(true);

    expect(await storage.exists('/file4.txt')).toBe(false);
    expect(await storage.exists('//file4.txt')).toBe(false);

    await storage.delete('/file1.txt');
    await storage.delete('/file2.txt');

    expect(await storage.exists('/file1.txt')).toBe(false);
    expect(await storage.exists('/file2.txt')).toBe(false);
    expect(await storage.exists('/file3.txt')).toBe(true);

    await storage.deleteDirectory('/');
    expect(await storage.exists('/file3.txt')).toBe(false);
});

test('recursive', async () => {
    const storage = new Storage(await adapterFactory());

    await storage.write('/file1.txt', 'contents1');
    await storage.write('/folder/file1.txt', 'contents2');
    await storage.write('/folder/file2.txt', 'contents3');
    await storage.write('/folder2/file2.txt', 'contents4');
    await storage.write('/folder2/file3.txt', 'contents5');
    await storage.write('/folder2/folder3/file4.txt', 'contents6');

    const files = await storage.files('/');
    expect(files).toMatchObject([
        { path: '/folder', type: FileType.Directory },
        { path: '/folder2', type: FileType.Directory },
        { path: '/file1.txt', type: FileType.File, lastModified: expect.any(Date) },
    ]);

    const files2 = await storage.files('/folder2');
    expect(files2).toMatchObject([
        { path: '/folder2/folder3', type: FileType.Directory },
        { path: '/folder2/file2.txt', type: FileType.File, lastModified: expect.any(Date) },
        { path: '/folder2/file3.txt', type: FileType.File, lastModified: expect.any(Date) },
    ]);

    const files3 = await storage.allFiles('/');
    const fileNames3 = files3.map(f => f.path);
    expect(fileNames3).toEqual([
        '/folder',
        '/folder2',
        '/folder2/folder3',
        '/file1.txt',
        '/folder/file1.txt',
        '/folder/file2.txt',
        '/folder2/file2.txt',
        '/folder2/file3.txt',
        '/folder2/folder3/file4.txt',
    ]);

    const directories = await storage.directories('/');
    expect(directories).toMatchObject([
        { path: '/folder', type: FileType.Directory },
        { path: '/folder2', type: FileType.Directory },
    ]);

    const directories2 = await storage.directories('/folder2');
    expect(directories2).toMatchObject([
        { path: '/folder2/folder3', type: FileType.Directory },
    ]);

    const directories3 = await storage.allDirectories('/');
    expect(directories3).toMatchObject([
        { path: '/folder', type: FileType.Directory },
        { path: '/folder2', type: FileType.Directory },
        { path: '/folder2/folder3', type: FileType.Directory },
    ]);
});

test('copy', async () => {
    const storage = new Storage(await adapterFactory());

    await storage.write('/file1.txt', 'contents1');
    await storage.write('/folder/file1.txt', 'contents2');
    await storage.write('/folder/file2.txt', 'contents3');

    await storage.copy('/file1.txt', '/file2.txt');
    await storage.copy('/folder/file1.txt', '/folder/file3.txt');

    expect(await storage.exists('/file1.txt')).toBe(true);
    expect(await storage.exists('/file2.txt')).toBe(true);

    expect(await storage.readAsText('/file1.txt')).toBe('contents1');
    expect(await storage.readAsText('/file2.txt')).toBe('contents1');

    await storage.copy('/folder', '/folder2');
    expect(await storage.exists('/folder/file1.txt')).toBe(true);
    expect(await storage.exists('/folder2/file1.txt')).toBe(true);
    expect(await storage.exists('/folder2/file2.txt')).toBe(true);
    expect(await storage.exists('/folder2/file3.txt')).toBe(true);
});

test('move', async () => {
    const storage = new Storage(await adapterFactory());

    await storage.write('/file1.txt', 'contents1');
    await storage.write('/folder/file1.txt', 'contents2');
    await storage.write('/folder/file2.txt', 'contents3');

    await storage.move('/file1.txt', '/file2.txt');
    await storage.move('/folder/file1.txt', '/folder/file3.txt');

    expect(await storage.exists('/file1.txt')).toBe(false);
    expect(await storage.exists('/file2.txt')).toBe(true);

    expect(await storage.readAsText('/file2.txt')).toBe('contents1');

    await storage.move('/folder', '/folder2');
    expect(await storage.exists('/folder/file1.txt')).toBe(false);
    expect(await storage.exists('/folder/file3.txt')).toBe(false);
    expect(await storage.exists('/folder2/file2.txt')).toBe(true);
    expect(await storage.exists('/folder2/file3.txt')).toBe(true);
});
