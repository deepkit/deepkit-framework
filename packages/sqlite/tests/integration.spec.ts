import { test } from '@jest/globals';
import { activeRecordTests, aggregateTest, bookstoreTests, companyTests, executeTest, softDeleteTests, usersTests, variousTests } from '@deepkit/orm-integration';
import { databaseFactory } from './factory';

for (const i in bookstoreTests) {
    test(i, executeTest(bookstoreTests[i], databaseFactory));
}

for (const i in companyTests) {
    test(i, executeTest(companyTests[i], databaseFactory));
}

for (const i in variousTests) {
    test(i, executeTest(variousTests[i], databaseFactory));
}

for (const i in usersTests) {
    test(i, async () => {
        await usersTests[i](databaseFactory);
    });
}

for (const i in activeRecordTests) {
    test(i, executeTest(activeRecordTests[i], databaseFactory));
}

for (const i in softDeleteTests) {
    test(i, executeTest(softDeleteTests[i], databaseFactory));
}

for (const i in aggregateTest) {
    test(i, executeTest(aggregateTest[i], databaseFactory));
}

test('placeholder', async () => {
});

