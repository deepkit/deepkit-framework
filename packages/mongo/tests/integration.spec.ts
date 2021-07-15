import { test } from '@jest/globals';
import { activeRecordTests, aggregateTest, bookstoreTests, companyTests, softDeleteTests, usersTests, variousTests } from '@deepkit/orm-integration';
import { databaseFactory } from './factory';

for (const i in bookstoreTests) {
    test(i, async () => {
        await bookstoreTests[i](databaseFactory);
    });
}

for (const i in variousTests) {
    test(i, async () => {
        await variousTests[i](databaseFactory);
    });
}

for (const i in companyTests) {
    test(i, async () => {
        await companyTests[i](databaseFactory);
    });
}

for (const i in usersTests) {
    test(i, async () => {
        await usersTests[i](databaseFactory);
    });
}

for (const i in activeRecordTests) {
    test(i, async () => {
        await activeRecordTests[i](databaseFactory);
    });
}

for (const i in softDeleteTests) {
    test(i, async () => {
        await softDeleteTests[i](databaseFactory);
    });
}

for (const i in aggregateTest) {
    test(i, async () => {
        await aggregateTest[i](databaseFactory);
    });
}


test('placeholder', async () => {
});

