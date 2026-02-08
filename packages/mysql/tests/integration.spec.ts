import { test } from '@jest/globals';

import { runIntegrationTests } from '@deepkit/orm-integration';

import { databaseFactory } from './factory.js';

runIntegrationTests(databaseFactory);

test('placeholder', async () => {});
