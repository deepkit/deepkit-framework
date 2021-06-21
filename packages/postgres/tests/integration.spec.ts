import { activeRecordTests, aggregateTest, bookstoreTests, executeTest, softDeleteTests } from '@deepkit/orm-integration';
import { databaseFactory } from './factory';
import { test } from '@jest/globals';

for (const i in bookstoreTests) {
    test(i, executeTest(bookstoreTests[i], databaseFactory));
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

