import { test } from '@jest/globals';
import { setAdapterFactory } from '@deepkit/filesystem/test';
import { FilesystemSftpAdapter } from '../src/sftp-adapter.js';
import { platform } from 'os';

setAdapterFactory(async () => {
    let adapter = new FilesystemSftpAdapter({
        host: 'localhost',
        port: 2222,
        user: 'user',
        password: '123',
        root: 'upload'
    });

    if (platform() === 'darwin') {
        // docker run -d --name storage-sftp -p 22:22 -e SFTP_USERS=user:123:::upload -d atmoz/sftp:alpine
        adapter = new FilesystemSftpAdapter({
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
