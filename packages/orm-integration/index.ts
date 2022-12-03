import { bookstoreTests } from './src/bookstore';
import { test } from '@jest/globals';
import { variousTests } from './src/various';
import { companyTests } from './src/company';
import { usersTests } from './src/users';
import { activeRecordTests } from './src/active-record';
import { softDeletePluginTests } from './src/soft-delete-plugin';
import { aggregateTest } from './src/aggregate';
import { DatabaseFactory } from './src/test';
import { logPluginTests } from './src/log-plugin.js';

export * from './src/bookstore';
export * from './src/active-record';
export * from './src/soft-delete-plugin';
export * from './src/aggregate';
export * from './src/users';

export * from './src/various';
export * from './src/test';
export * from './src/active-record/book-tag';
export * from './src/active-record/book';
export * from './src/active-record/tag';
export * from './src/bookstore/group';
export * from './src/bookstore/user';
export * from './src/bookstore/user-credentials';
export * from './src/company';

export function runIntegrationTests(databaseFactory: DatabaseFactory) {
    for (const i in bookstoreTests) {
        test('bookstore:' + i, async () => {
            await bookstoreTests[i](databaseFactory);
        });
    }

    for (const i in variousTests) {
        test('various:' + i, async () => {
            await variousTests[i](databaseFactory);
        });
    }

    for (const i in companyTests) {
        test('company:' + i, async () => {
            await companyTests[i](databaseFactory);
        });
    }

    for (const i in usersTests) {
        test('users:' + i, async () => {
            await usersTests[i](databaseFactory);
        });
    }

    for (const i in activeRecordTests) {
        test('activeRecord:' + i, async () => {
            await activeRecordTests[i](databaseFactory);
        });
    }

    for (const i in softDeletePluginTests) {
        test('softDelete:' + i, async () => {
            await softDeletePluginTests[i](databaseFactory);
        });
    }

    for (const i in logPluginTests) {
        test('log:' + i, async () => {
            await logPluginTests[i](databaseFactory);
        });
    }

    for (const i in aggregateTest) {
        test('aggregate:' + i, async () => {
            await aggregateTest[i](databaseFactory);
        });
    }
}
