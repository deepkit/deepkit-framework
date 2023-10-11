import { test } from '@jest/globals';
import './storage.spec.js';
import { Storage } from '@deepkit/storage';
import { adapterFactory, setAdapterFactory } from '@deepkit/storage/test';
import { StorageGoogleAdapter } from '../src/google-adapter.js';
import { homedir } from 'os';
import { writeFileSync } from 'fs';

Error.stackTraceLimit = 50;

setAdapterFactory(async () => {
    const folder = 'test-folder-dont-delete';

    const keyFilename = homedir() + '/.google/deepkit-storage-integration-tests.json';
    if (process.env.GOOGLE_STORAGE_KEY) {
        writeFileSync(keyFilename, process.env.GOOGLE_STORAGE_KEY);
    }

    let adapter = new StorageGoogleAdapter({
        bucket: 'deepkit-integration-tests',
        path: folder,
        projectId: 'deepkit',
        keyFilename,
        // jsonAuth: process.env.GOOGLE_STORAGE_KEY
    });

    //reset all files
    const storage = new Storage(adapter);
    await storage.deleteDirectory('/');

    return adapter;
});

test('base', async () => {
    const storage = new Storage(await adapterFactory());
    await storage.write('/hello.txt', 'hello world', 'public');
    await storage.write('/secret.txt', '🔥', 'private');
    // const content = await storage.readAsText('/hello.txt');
    // expect(content).toBe('hello world');
    //
    // await storage.makeDirectory('/folder12');
    // await storage.makeDirectory('/folder1');
    // await storage.makeDirectory('/folder1/yes');

    // const files = await storage.files('/folder');
    // console.log(files);

    // const file1 = await storage.get('/hello.txt');
    // console.log('hello.txt', file1);

    const file2 = await storage.get('/secret.txt');
    console.log('secret.txt', file2);

    // const dir = await storage.get('/folder1');
    // console.log('fodler1', dir);
    //
    // const files = await storage.files('/');
    // console.log('/', files);
});

// since we import .storage.spec.js, all its tests are scheduled to run
// we define 'basic' here too, so we can easily run just this test.
// also necessary to have at least once test in this file, so that WebStorm
// detects the file as a test file.
test('url', () => undefined);
test('basic', () => undefined);
test('append/prepend', () => undefined);
test('visibility', () => undefined);
test('recursive', () => undefined);
test('copy', () => undefined);
test('move', () => undefined);
