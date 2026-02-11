import { test } from 'node:test';

import { runIntegrationTests } from '@deepkit/orm-integration';

import { databaseFactory } from './factory.js';

runIntegrationTests(databaseFactory);

test('placeholder', async () => {});
