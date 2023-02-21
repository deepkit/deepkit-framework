import { bookstoreTests } from './src/bookstore.js';
import { test } from '@jest/globals';
import { variousTests } from './src/various.js';
import { companyTests } from './src/company.js';
import { usersTests } from './src/users.js';
import { activeRecordTests } from './src/active-record.js';
import { softDeletePluginTests } from './src/soft-delete-plugin.js';
import { aggregateTest } from './src/aggregate.js';
import { DatabaseFactory } from './src/test.js';
import { logPluginTests } from './src/log-plugin.js';

export * from './src/bookstore.js';
export * from './src/active-record.js';
export * from './src/soft-delete-plugin.js';
export * from './src/aggregate.js';
export * from './src/users.js';

export * from './src/various.js';
export * from './src/test.js';
export * from './src/active-record/book-tag.js';
export * from './src/active-record/book.js';
export * from './src/active-record/tag.js';
export * from './src/bookstore/group.js';
export * from './src/bookstore/user.js';
export * from './src/bookstore/user-credentials.js';
export * from './src/company.js';

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
