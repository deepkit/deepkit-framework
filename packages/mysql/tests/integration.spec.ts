import { bookstoreTests, activeRecordTests } from '@deepkit/orm-integration';
import { databaseFactory } from './factory';

for (const i in bookstoreTests) {
    test(i, async () => {
        await bookstoreTests[i](databaseFactory);
    });
}

for (const i in activeRecordTests) {
    test(i, async () => {
        await activeRecordTests[i](databaseFactory);
    });
}

test('placeholder', async () => {
});

