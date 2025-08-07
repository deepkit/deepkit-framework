import { test } from '@jest/globals';
import { setAdapterFactory } from '@deepkit/filesystem/test';
import { FilesystemDatabaseAdapter } from '../src/database-adapter.js';
import { Database, MemoryDatabaseAdapter } from '@deepkit/orm';

setAdapterFactory(async () => {
    const database = new Database(new MemoryDatabaseAdapter());
    return new FilesystemDatabaseAdapter({ database });
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
