import { test } from 'node:test';
import { writeFileSync } from 'fs';
import { homedir } from 'os';

import { Filesystem } from '@deepkit/filesystem';
import { adapterFactory, setAdapterFactory } from '@deepkit/filesystem/test';

import { FilesystemGoogleAdapter } from '../src/google-adapter.js';

Error.stackTraceLimit = 50;

// Configure via environment variables or use defaults for docker compose (fake-gcs-server)
// docker compose up -d  (uses port 10443)
const GCS_ENDPOINT = process.env.GCS_ENDPOINT || 'http://localhost:10443';
const GCS_BUCKET = process.env.GCS_BUCKET || 'deepkit-test';
const GCS_PROJECT_ID = process.env.GCS_PROJECT_ID || 'test-project';

setAdapterFactory(async () => {
    const folder = 'test-folder-dont-delete';

    // Check if using fake-gcs-server (local testing) or real GCS
    const useFakeGcs = GCS_ENDPOINT.includes('localhost');

    if (useFakeGcs) {
        // Use fake-gcs-server for local testing
        const adapter = new FilesystemGoogleAdapter({
            bucket: GCS_BUCKET,
            path: folder,
            projectId: GCS_PROJECT_ID,
            apiEndpoint: GCS_ENDPOINT,
        });

        //reset all files
        try {
            const filesystem = new Filesystem(adapter);
            await filesystem.deleteDirectory('/');
        } catch (e) {
            // Bucket might not exist yet, that's fine
        }

        return adapter;
    }

    // Real GCS configuration
    const keyFilename = homedir() + '/.google/deepkit-filesystem-integration-tests.json';
    if (process.env.GOOGLE_STORAGE_KEY) {
        writeFileSync(keyFilename, process.env.GOOGLE_STORAGE_KEY);
    }

    const adapter = new FilesystemGoogleAdapter({
        bucket: 'deepkit-integration-tests',
        path: folder,
        projectId: 'deepkit',
        keyFilename,
    });

    //reset all files
    const filesystem = new Filesystem(adapter);
    await filesystem.deleteDirectory('/');

    return adapter;
});

test('base', async () => {
    const filesystem = new Filesystem(await adapterFactory());
    await filesystem.write('/hello.txt', 'hello world', 'public');
    await filesystem.write('/secret.txt', '🔥', 'private');
    // const content = await filesystem.readAsText('/hello.txt');
    // expect(content).toBe('hello world');
    //
    // await filesystem.makeDirectory('/folder12');
    // await filesystem.makeDirectory('/folder1');
    // await filesystem.makeDirectory('/folder1/yes');

    // const files = await filesystem.files('/folder');
    // console.log(files);

    // const file1 = await filesystem.get('/hello.txt');
    // console.log('hello.txt', file1);

    const file2 = await filesystem.get('/secret.txt');
    console.log('secret.txt', file2);

    // const dir = await filesystem.get('/folder1');
    // console.log('fodler1', dir);
    //
    // const files = await filesystem.files('/');
    // console.log('/', files);
});

// since we import .filesystem.spec.js, all its tests are scheduled to run
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
