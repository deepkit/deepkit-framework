import { test } from '@jest/globals';
import './storage.spec.js';
import { setAdapterFactory } from '@deepkit/storage/test';
import { StorageFtpAdapter } from '../src/ftp-adapter.js';
import { platform } from 'os';

setAdapterFactory(async () => {
    let adapter = new StorageFtpAdapter({
        host: 'localhost',
        user: 'user',
        password: '123',
    });;
    if (platform() === 'darwin') {
        // docker run -d --name storage-ftp -p 20-21:20-21 -p 40000-40009:40000-40009 --env FTP_USER=user --env FTP_PASS=123 garethflowers/ftp-server
        adapter = new StorageFtpAdapter({
            host: 'storage-ftp.orb.local',
            port: 21,
            user: 'user',
            password: '123',
        });
    }
    //reset all files
    await adapter.clearWorkingDir();

    return adapter;
});

// since we import .storage.spec.js, all its tests are scheduled to run
// we define 'basic' here too, so we can easily run just this test.
// also necessary to have at least once test in this file, so that WebStorm
// detects the file as a test file.
test('basic', () => undefined);
test('recursive', () => undefined);
test('copy', () => undefined);
test('move', () => undefined);
