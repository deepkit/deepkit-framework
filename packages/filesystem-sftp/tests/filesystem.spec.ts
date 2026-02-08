import { test } from '@jest/globals';

import { setAdapterFactory } from '@deepkit/filesystem/test';

import { FilesystemSftpAdapter } from '../src/sftp-adapter.js';

// Configure via environment variables or use defaults for docker compose
// docker compose up -d  (uses port 10022)
const SFTP_HOST = process.env.SFTP_HOST || 'localhost';
const SFTP_PORT = parseInt(process.env.SFTP_PORT || '10022', 10);
const SFTP_USER = process.env.SFTP_USER || 'user';
const SFTP_PASSWORD = process.env.SFTP_PASSWORD || '123';
const SFTP_ROOT = process.env.SFTP_ROOT || 'upload';

setAdapterFactory(async () => {
    const adapter = new FilesystemSftpAdapter({
        host: SFTP_HOST,
        port: SFTP_PORT,
        user: SFTP_USER,
        password: SFTP_PASSWORD,
        root: SFTP_ROOT,
    });

    //reset all files
    try {
        await adapter.delete((await adapter.files('/')).map(v => v.path));
    } catch (e) {
        // Directory might be empty or not exist yet
    }

    return adapter;
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
