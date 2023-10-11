import { expect, test } from '@jest/globals';
import { FilesystemFile, pathDirectories, resolveFilesystemPath } from '../src/filesystem.js';

test('utils pathDirectories', async () => {
    expect(pathDirectories('/')).toEqual([]);
    expect(pathDirectories('/folder')).toEqual(['/folder']);
    expect(pathDirectories('/folder/')).toEqual(['/folder']);
    expect(pathDirectories('/folder/folder2')).toEqual(['/folder', '/folder/folder2']);
});

test('utils resolveFilesystemPath', async () => {
    expect(resolveFilesystemPath('/')).toBe('/');
    expect(resolveFilesystemPath('/abc')).toBe('/abc');
    expect(resolveFilesystemPath('/abc/')).toBe('/abc');

    expect(resolveFilesystemPath(['/', '/abc'])).toBe('/abc');
    expect(resolveFilesystemPath(['/abc', '/'])).toBe('/abc');
    expect(resolveFilesystemPath(['/abc', '///'])).toBe('/abc');
    expect(resolveFilesystemPath(['/abc', '///yes'])).toBe('/abc/yes');
});

test('file API', async () => {
    {
        const file = new FilesystemFile('/file.txt');
        expect(file.path).toBe('/file.txt');
        expect(file.name).toBe('file.txt');
        expect(file.directory).toBe('/');
        expect(file.visibility).toBe('unknown');
        expect(file.size).toBe(0);
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
        const file = new FilesystemFile('/folder/file.txt');
        expect(file.path).toBe('/folder/file.txt');
        expect(file.name).toBe('file.txt');
        expect(file.directory).toBe('/folder');
        expect(file.size).toBe(0);
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
        const file = new FilesystemFile('/folder/folder2/file.txt');
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
        const file = new FilesystemFile('/folder', 'directory');
        expect(file.path).toBe('/folder');
        expect(file.name).toBe('folder');
        expect(file.directory).toBe('/');
        expect(file.size).toBe(0);
        expect(file.extension).toBe('');
        expect(file.lastModified).toBe(undefined);
        expect(file.isFile()).toBe(false);
        expect(file.isDirectory()).toBe(true);
        expect(file.inDirectory('/')).toBe(true);
        expect(file.inDirectory('/folder')).toBe(false);
        expect(file.inDirectory('/another/folder')).toBe(false);
    }
});
