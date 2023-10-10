import { test } from '@jest/globals';
import './storage.spec.js';
import { setAdapterFactory } from '@deepkit/storage/test';
import { StorageSftpAdapter } from '../src/sftp-adapter.js';
import { platform } from 'os';

setAdapterFactory(async () => {
    let adapter = new StorageSftpAdapter({
        host: 'localhost',
        user: 'user',
        password: '123',
        root: 'upload'
    });;
    if (platform() === 'darwin') {
        // docker run -d --name storage-sftp -p 22:22 -d atmoz/sftp user:123:::upload
        adapter = new StorageSftpAdapter({
            host: 'storage-sftp.orb.local',
            user: 'user',
            password: '123',
            root: 'upload'
        });
    }

    //reset all files
    await adapter.delete((await adapter.files('/')).map(v => v.path));

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
