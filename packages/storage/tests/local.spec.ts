import { expect, test } from '@jest/globals';
import './storage.spec.js';
import { adapterFactory, setAdapterFactory } from './storage.spec.js';
import { StorageLocalAdapter } from '../src/local-adapter.js';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { Storage } from '../src/storage.js';

setAdapterFactory(async () => {
    const tmp = mkdtempSync(tmpdir() + '/storage-test-');
    return new StorageLocalAdapter({root: tmp});
});

// since we import .storage.spec.js, all its tests are scheduled to run
// we define 'basic' here too, so we can easily run just this test.
// also necessary to have at least once test in this file, so that WebStorm
// detects the file as a test file.
test('basic', () => undefined);
test('recursive', () => undefined);
test('permissions', () => undefined);
test('copy', () => undefined);
test('move', () => undefined);
