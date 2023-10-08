import { test } from '@jest/globals';
import './storage.spec.js';
import { setAdapterFactory } from '@deepkit/storage/test';
import { StorageAwsS3Adapter } from '../src/s3-adapter.js';
import { DeleteObjectsCommand, ListObjectsCommand } from '@aws-sdk/client-s3';

setAdapterFactory(async () => {
    const folder = 'test-folder-dont-delete';
    const adapter = new StorageAwsS3Adapter({
        region: 'eu-central-1',
        bucket: 'deepkit-storage-integration-tests',
        path: folder,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    });

    const response = await adapter.client.send(new ListObjectsCommand({
        Bucket: adapter.options.bucket,
        Prefix: folder + '/',
    }));
    if (response.Contents) {
        await adapter.client.send(new DeleteObjectsCommand({
            Bucket: adapter.options.bucket,
            Delete: {
                Objects: response.Contents.map(v => ({ Key: v.Key })),
            }
        }));
    }

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
