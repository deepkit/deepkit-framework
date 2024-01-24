import { DeleteObjectsCommand, ListObjectsCommand } from '@aws-sdk/client-s3';
import { expect, test } from '@jest/globals';

import { Filesystem } from '@deepkit/filesystem';
import { adapterFactory, setAdapterFactory } from '@deepkit/filesystem/test';

import { FilesystemAwsS3Adapter } from '../src/s3-adapter.js';

setAdapterFactory(async () => {
    const folder = 'test-folder-dont-delete';
    const adapter = new FilesystemAwsS3Adapter({
        region: 'eu-central-1',
        bucket: 'deepkit-filesystem-integration-tests',
        path: folder,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    });

    const response = await adapter.client.send(
        new ListObjectsCommand({
            Bucket: adapter.options.bucket,
            Prefix: folder + '/',
        }),
    );
    if (response.CommonPrefixes) {
        await adapter.client.send(
            new DeleteObjectsCommand({
                Bucket: adapter.options.bucket,
                Delete: {
                    Objects: response.CommonPrefixes.map(v => ({
                        Key: v.Prefix,
                    })),
                },
            }),
        );
    }
    if (response.Contents) {
        await adapter.client.send(
            new DeleteObjectsCommand({
                Bucket: adapter.options.bucket,
                Delete: {
                    Objects: response.Contents.map(v => ({ Key: v.Key })),
                },
            }),
        );
    }

    return adapter;
});

test('s3 url', async () => {
    const filesystem = new Filesystem(await adapterFactory());

    await filesystem.write('test.txt', 'abc', 'public');
    const url = await filesystem.publicUrl('test.txt');
    expect(url).toBe(
        'https://deepkit-filesystem-integration-tests.s3.eu-central-1.amazonaws.com/test-folder-dont-delete/test.txt',
    );
});

// since we import .filesystem.spec.js, all its tests are scheduled to run
// we define 'basic' here too, so we can easily run just this test.
// also necessary to have at least once test in this file, so that WebStorm
// detects the file as a test file.
test('basic', () => undefined);
test('visibility', () => undefined);
test('recursive', () => undefined);
test('copy', () => undefined);
test('move', () => undefined);
