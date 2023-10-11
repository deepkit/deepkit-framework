import { expect, jest, test } from '@jest/globals';
import { FileType, Storage, StorageAdapter } from '../src/storage.js';
import { StorageMemoryAdapter } from '../src/memory-adapter.js';

jest.setTimeout(30000);

export let adapterFactory: () => Promise<StorageAdapter> = async () => new StorageMemoryAdapter;

export function setAdapterFactory(factory: () => Promise<StorageAdapter>) {
    adapterFactory = factory;
}

test('url', async () => {
    const storage = new Storage(await adapterFactory(), { baseUrl: 'http://localhost/assets/' });
    if (storage.adapter.publicUrl) {
        //has custom tests
        await storage.close();
        return;
    }

    //this test is about URL mapping feature from Storage
    const url = await storage.publicUrl('/file1.txt');
    expect(url).toBe('http://localhost/assets/file1.txt');

    await storage.close();
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

    await storage.write('/file1.txt', 'overridden');
    expect(await storage.readAsText('/file1.txt')).toBe('overridden');

    await storage.delete('/file1.txt');
    await storage.delete('/file2.txt');

    expect(await storage.exists('/file1.txt')).toBe(false);
    expect(await storage.exists('/file2.txt')).toBe(false);
    expect(await storage.exists('/file3.txt')).toBe(true);

    await storage.deleteDirectory('/');
    expect(await storage.exists('/file3.txt')).toBe(false);

    await storage.close();
});

test('append/prepend', async () => {
    const storage = new Storage(await adapterFactory());

    await storage.write('/file1.txt', 'contents1');
    await storage.write('/file2.txt', 'contents2');

    await storage.append('/file1.txt', 'moredata');
    await storage.append('/file1.txt', 'evenmore');
    expect(await storage.readAsText('/file1.txt')).toBe('contents1moredataevenmore');

    await storage.prepend('/file2.txt', 'prefixed');
    expect(await storage.readAsText('/file2.txt')).toBe('prefixedcontents2');

    await storage.close();
});

test('visibility', async () => {
    const adapter = await adapterFactory();
    if (!adapter.supportsVisibility()) {
        if (adapter.close) await adapter.close();
        return;
    }

    const storage = new Storage(adapter);
    await storage.write('/file1.txt', 'contents1', 'public');
    await storage.write('/file2.txt', 'contents2', 'private');

    const file1 = await storage.get('/file1.txt');
    expect(file1).toMatchObject({ path: '/file1.txt', size: 9, lastModified: expect.any(Date), visibility: 'public' });

    const file2 = await storage.get('/file2.txt');
    expect(file2).toMatchObject({ path: '/file2.txt', size: 9, lastModified: expect.any(Date), visibility: 'private' });

    if (adapter.supportsDirectory()) {
        await storage.makeDirectory('/folder1', 'public');
        await storage.makeDirectory('/folder2', 'private');

        const folder1 = await storage.get('/folder1');
        expect(folder1).toMatchObject({ path: '/folder1', size: 0, visibility: 'public' });

        const folder2 = await storage.get('/folder2');
        expect(folder2).toMatchObject({ path: '/folder2', size: 0, visibility: 'private' });

    }

    await storage.setVisibility('file2.txt', 'public');
    const file2b = await storage.get('/file2.txt');
    expect(file2b).toMatchObject({ path: '/file2.txt', size: 9, lastModified: expect.any(Date), visibility: 'public' });

    await storage.close();
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

    let expected = [
        '/folder',
        '/folder2',
        '/folder2/folder3',
        '/file1.txt',
        '/folder/file1.txt',
        '/folder/file2.txt',
        '/folder2/file2.txt',
        '/folder2/file3.txt',
        '/folder2/folder3/file4.txt',
    ];

    if (!storage.adapter.supportsDirectory()) {
        expected = expected.filter(v => v !== '/folder' && v !== '/folder2' && v !== '/folder2/folder3');
    }
    expect(fileNames3).toEqual(expected);

    const directories = await storage.directories('/');
    expect(directories).toMatchObject([
        { path: '/folder', type: FileType.Directory },
        { path: '/folder2', type: FileType.Directory },
    ]);

    const directories2 = await storage.directories('/folder2');
    expect(directories2).toMatchObject([
        { path: '/folder2/folder3', type: FileType.Directory },
    ]);

    if (storage.adapter.supportsDirectory()) {
        const directories3 = await storage.allDirectories('/');
        expect(directories3).toMatchObject([
            { path: '/folder', type: FileType.Directory },
            { path: '/folder2', type: FileType.Directory },
            { path: '/folder2/folder3', type: FileType.Directory },
        ]);
    }

    await storage.close();
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

    await storage.close();
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
    await storage.close();
});
