import { bookstoreTests } from '@deepkit/orm-integration';
import { databaseFactory } from './factory';

for (const i in bookstoreTests) {
    test(i, async () => {
        await bookstoreTests[i](databaseFactory);
    });
}

test('placeholder', async () => {
});

