import { describe } from 'node:test';

import { setAdapterFactory } from '@deepkit/broker/test';
import { ConsoleLogger } from '@deepkit/logger';

import { RedisBrokerAdapter } from '../src/broker-redis.js';

setAdapterFactory(() => {
    return new RedisBrokerAdapter({}, new ConsoleLogger());
});

// since we import /test, all its tests are scheduled to run
// we define them here too, so we can easily run just this test.
describe('key-value', () => undefined);
describe('cache', () => undefined);
describe('bus', () => undefined);
describe('lock', () => undefined);
describe('queue', () => undefined);
