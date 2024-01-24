import { expect, jest, test } from '@jest/globals';

import { Filesystem, FilesystemAdapter } from '../src/filesystem.js';
import { FilesystemMemoryAdapter } from '../src/memory-adapter.js';

jest.setTimeout(30000);

export let adapterFactory: () => Promise<FilesystemAdapter> = async () => new FilesystemMemoryAdapter();

export function setAdapterFactory(factory: () => Promise<FilesystemAdapter>) {
    adapterFactory = factory;
}

test('url', async () => {
    const filesystem = new Filesystem(await adapterFactory(), {
        baseUrl: 'http://localhost/assets/',
    });
    if (filesystem.adapter.publicUrl) {
        //has custom tests
        await filesystem.close();
        return;
    }

    //this test is about URL mapping feature from Filesystem
    const url = filesystem.publicUrl('/file1.txt');
    expect(url).toBe('http://localhost/assets/file1.txt');

    await filesystem.close();
});

test('basic', async () => {
    const filesystem = new Filesystem(await adapterFactory());

    const files = await filesystem.files('/');
    expect(files).toEqual([]);

    await filesystem.write('/file1.txt', 'contents1');
    await filesystem.write('/file2.txt', 'contents2');
    await filesystem.write('/file3.txt', 'abc');

    const files2 = await filesystem.files('/');
    expect(files2).toMatchObject([
        { path: '/file1.txt', size: 9, lastModified: expect.any(Date) },
        { path: '/file2.txt', size: 9, lastModified: expect.any(Date) },
        { path: '/file3.txt', size: 3, lastModified: expect.any(Date) },
    ]);

    const content = await filesystem.readAsText('/file1.txt');
    expect(content).toBe('contents1');

    const file = await filesystem.get('/file1.txt');
    expect(file).toMatchObject({
        path: '/file1.txt',
        size: 9,
        lastModified: expect.any(Date),
    });

    await expect(() => filesystem.get('/file4.txt')).rejects.toThrowError('File not found');
    expect(await filesystem.getOrUndefined('/file4.txt')).toBe(undefined);

    expect(await filesystem.exists('/file1.txt')).toBe(true);
    expect(await filesystem.exists('/file2.txt')).toBe(true);
    expect(await filesystem.exists('/file3.txt')).toBe(true);
    expect(await filesystem.exists('//file3.txt')).toBe(true);
    expect(await filesystem.exists('/file3.txt/')).toBe(true);
    expect(await filesystem.exists('//file3.txt/')).toBe(true);

    expect(await filesystem.exists('/file4.txt')).toBe(false);
    expect(await filesystem.exists('//file4.txt')).toBe(false);

    await filesystem.write('/file1.txt', 'overridden');
    expect(await filesystem.readAsText('/file1.txt')).toBe('overridden');

    await filesystem.delete('/file1.txt');
    await filesystem.delete('/file2.txt');

    expect(await filesystem.exists('/file1.txt')).toBe(false);
    expect(await filesystem.exists('/file2.txt')).toBe(false);
    expect(await filesystem.exists('/file3.txt')).toBe(true);

    await filesystem.deleteDirectory('/');
    expect(await filesystem.exists('/file3.txt')).toBe(false);

    await filesystem.close();
});

test('append/prepend', async () => {
    const filesystem = new Filesystem(await adapterFactory());

    await filesystem.write('/file1.txt', 'contents1');
    await filesystem.write('/file2.txt', 'contents2');

    await filesystem.append('/file1.txt', 'moredata');
    await filesystem.append('/file1.txt', 'evenmore');
    expect(await filesystem.readAsText('/file1.txt')).toBe('contents1moredataevenmore');

    await filesystem.prepend('/file2.txt', 'prefixed');
    expect(await filesystem.readAsText('/file2.txt')).toBe('prefixedcontents2');

    await filesystem.close();
});

test('visibility', async () => {
    const adapter = await adapterFactory();
    if (!adapter.supportsVisibility()) {
        if (adapter.close) await adapter.close();
        return;
    }

    const filesystem = new Filesystem(adapter);
    await filesystem.write('/file1.txt', 'contents1', 'public');
    await filesystem.write('/file2.txt', 'contents2', 'private');

    const file1 = await filesystem.get('/file1.txt');
    expect(file1).toMatchObject({
        path: '/file1.txt',
        size: 9,
        lastModified: expect.any(Date),
        visibility: 'public',
    });

    const file2 = await filesystem.get('/file2.txt');
    expect(file2).toMatchObject({
        path: '/file2.txt',
        size: 9,
        lastModified: expect.any(Date),
        visibility: 'private',
    });

    if (adapter.supportsDirectory()) {
        await filesystem.makeDirectory('/folder1', 'public');
        await filesystem.makeDirectory('/folder2', 'private');

        const folder1 = await filesystem.get('/folder1');
        expect(folder1).toMatchObject({
            path: '/folder1',
            size: 0,
            visibility: 'public',
        });

        const folder2 = await filesystem.get('/folder2');
        expect(folder2).toMatchObject({
            path: '/folder2',
            size: 0,
            visibility: 'private',
        });
    }

    await filesystem.setVisibility('file2.txt', 'public');
    const file2b = await filesystem.get('/file2.txt');
    expect(file2b).toMatchObject({
        path: '/file2.txt',
        size: 9,
        lastModified: expect.any(Date),
        visibility: 'public',
    });

    await filesystem.close();
});

test('recursive', async () => {
    const filesystem = new Filesystem(await adapterFactory());

    await filesystem.write('/file1.txt', 'contents1');
    await filesystem.write('/folder/file1.txt', 'contents2');
    await filesystem.write('/folder/file2.txt', 'contents3');
    await filesystem.write('/folder2/file2.txt', 'contents4');
    await filesystem.write('/folder2/file3.txt', 'contents5');
    await filesystem.write('/folder2/folder3/file4.txt', 'contents6');

    const files = await filesystem.files('/');
    expect(files).toMatchObject([
        { path: '/folder', type: 'directory' },
        { path: '/folder2', type: 'directory' },
        { path: '/file1.txt', type: 'file', lastModified: expect.any(Date) },
    ]);

    const files2 = await filesystem.files('/folder2');
    expect(files2).toMatchObject([
        { path: '/folder2/folder3', type: 'directory' },
        {
            path: '/folder2/file2.txt',
            type: 'file',
            lastModified: expect.any(Date),
        },
        {
            path: '/folder2/file3.txt',
            type: 'file',
            lastModified: expect.any(Date),
        },
    ]);

    const files3 = await filesystem.allFiles('/');
    const fileNames3 = files3.map(f => f.path);

    let expected = ['/folder', '/folder2', '/folder2/folder3', '/file1.txt', '/folder/file1.txt', '/folder/file2.txt', '/folder2/file2.txt', '/folder2/file3.txt', '/folder2/folder3/file4.txt'];

    if (!filesystem.adapter.supportsDirectory()) {
        expected = expected.filter(v => v !== '/folder' && v !== '/folder2' && v !== '/folder2/folder3');
    }
    expect(fileNames3).toEqual(expected);

    const directories = await filesystem.directories('/');
    expect(directories).toMatchObject([
        { path: '/folder', type: 'directory' },
        { path: '/folder2', type: 'directory' },
    ]);

    const directories2 = await filesystem.directories('/folder2');
    expect(directories2).toMatchObject([{ path: '/folder2/folder3', type: 'directory' }]);

    if (filesystem.adapter.supportsDirectory()) {
        const directories3 = await filesystem.allDirectories('/');
        expect(directories3).toMatchObject([
            { path: '/folder', type: 'directory' },
            { path: '/folder2', type: 'directory' },
            { path: '/folder2/folder3', type: 'directory' },
        ]);
    }

    await filesystem.close();
});

test('copy', async () => {
    const filesystem = new Filesystem(await adapterFactory());

    await filesystem.write('/file1.txt', 'contents1');
    await filesystem.write('/folder/file1.txt', 'contents2');
    await filesystem.write('/folder/file2.txt', 'contents3');

    await filesystem.copy('/file1.txt', '/file2.txt');
    await filesystem.copy('/folder/file1.txt', '/folder/file3.txt');

    expect(await filesystem.exists('/file1.txt')).toBe(true);
    expect(await filesystem.exists('/file2.txt')).toBe(true);

    expect(await filesystem.readAsText('/file1.txt')).toBe('contents1');
    expect(await filesystem.readAsText('/file2.txt')).toBe('contents1');

    await filesystem.copy('/folder', '/folder2');
    expect(await filesystem.exists('/folder/file1.txt')).toBe(true);
    expect(await filesystem.exists('/folder2/file1.txt')).toBe(true);
    expect(await filesystem.exists('/folder2/file2.txt')).toBe(true);
    expect(await filesystem.exists('/folder2/file3.txt')).toBe(true);

    await filesystem.close();
});

test('move', async () => {
    const filesystem = new Filesystem(await adapterFactory());

    await filesystem.write('/file1.txt', 'contents1');
    await filesystem.write('/folder/file1.txt', 'contents2');
    await filesystem.write('/folder/file2.txt', 'contents3');

    await filesystem.move('/file1.txt', '/file2.txt');
    await filesystem.move('/folder/file1.txt', '/folder/file3.txt');

    expect(await filesystem.exists('/file1.txt')).toBe(false);
    expect(await filesystem.exists('/file2.txt')).toBe(true);

    expect(await filesystem.readAsText('/file2.txt')).toBe('contents1');

    await filesystem.move('/folder', '/folder2');
    expect(await filesystem.exists('/folder/file1.txt')).toBe(false);
    expect(await filesystem.exists('/folder/file3.txt')).toBe(false);
    expect(await filesystem.exists('/folder2/file2.txt')).toBe(true);
    expect(await filesystem.exists('/folder2/file3.txt')).toBe(true);
    await filesystem.close();
});
