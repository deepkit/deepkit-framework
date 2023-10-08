import { expect, test } from '@jest/globals';
import { Storage, StorageAdapter, StorageMemoryAdapter } from '../src/storage.js';

export let adapterFactory: () => Promise<StorageAdapter> = async () => new StorageMemoryAdapter;

export function setAdapterFactory(factory: () => Promise<StorageAdapter>) {
    adapterFactory = factory;
}

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
