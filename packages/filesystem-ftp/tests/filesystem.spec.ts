import { test } from '@jest/globals';

import { setAdapterFactory } from '@deepkit/filesystem/test';

import { FilesystemFtpAdapter } from '../src/ftp-adapter.js';

// Configure via environment variables or use defaults for docker compose
// docker compose up -d  (uses port 10021)
const FTP_HOST = process.env.FTP_HOST || 'localhost';
const FTP_PORT = parseInt(process.env.FTP_PORT || '10021', 10);
const FTP_USER = process.env.FTP_USER || 'user';
const FTP_PASSWORD = process.env.FTP_PASSWORD || '123';

setAdapterFactory(async () => {
    const adapter = new FilesystemFtpAdapter({
        host: FTP_HOST,
        port: FTP_PORT,
        user: FTP_USER,
        password: FTP_PASSWORD,
    });

    //reset all files
    await adapter.clearWorkingDir();

    return adapter;
});

// since we import .filesystem.spec.js, all its tests are scheduled to run
// we define 'basic' here too, so we can easily run just this test.
// also necessary to have at least once test in this file, so that WebStorm
// detects the file as a test file.
test('basic', () => undefined);
test('recursive', () => undefined);
test('visibility', () => undefined);
test('copy', () => undefined);
test('move', () => undefined);
