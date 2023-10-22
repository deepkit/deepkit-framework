import { test } from '@jest/globals';
import { setAdapterFactory } from '@deepkit/filesystem/test';
import { FilesystemFtpAdapter } from '../src/ftp-adapter.js';
import { platform } from 'os';

setAdapterFactory(async () => {
    let adapter = new FilesystemFtpAdapter({
        host: 'localhost',
        user: 'user',
        password: '123',
    });

    if (platform() === 'darwin') {
        // docker run -d --name filesystem-ftp -p 20-21:20-21 -p 40000-40009:40000-40009 --env FTP_USER=user --env FTP_PASS=123 garethflowers/ftp-server
        adapter = new FilesystemFtpAdapter({
            host: 'filesystem-ftp.orb.local',
            port: 21,
            user: 'user',
            password: '123',
        });
    }
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
