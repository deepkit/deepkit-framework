import { bookstoreTests } from './lib/bookstore.js';
import { test } from '@jest/globals';
import { variousTests } from './lib/various.js';
import { companyTests } from './lib/company.js';
import { usersTests } from './lib/users.js';
import { activeRecordTests } from './lib/active-record.js';
import { softDeletePluginTests } from './lib/soft-delete-plugin.js';
import { aggregateTest } from './lib/aggregate.js';
import { DatabaseFactory } from './lib/test.js';
import { logPluginTests } from './lib/log-plugin.js';

export * from './lib/bookstore.js';
export * from './lib/active-record.js';
export * from './lib/soft-delete-plugin.js';
export * from './lib/aggregate.js';
export * from './lib/users.js';

export * from './lib/various.js';
export * from './lib/test.js';
export * from './lib/active-record/book-tag.js';
export * from './lib/active-record/book.js';
export * from './lib/active-record/tag.js';
export * from './lib/bookstore/group.js';
export * from './lib/bookstore/user.js';
export * from './lib/bookstore/user-credentials.js';
export * from './lib/company.js';

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
