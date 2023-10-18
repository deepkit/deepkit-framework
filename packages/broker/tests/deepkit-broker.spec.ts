import { test } from '@jest/globals';
import { setAdapterFactory } from './broker.spec.js';
import { BrokerDeepkitAdapter } from '../src/adapters/deepkit-adapter.js';
import { BrokerKernel } from '../src/kernel.js';
import { RpcDirectClientAdapter } from '@deepkit/rpc';


setAdapterFactory(async () => {
    const kernel = new BrokerKernel();
    const client = new RpcDirectClientAdapter(kernel);
    return new BrokerDeepkitAdapter(client);
});

// since we import broker.spec.js, all its tests are scheduled to run
// we define 'basic' here too, so we can easily run just this test.
// also necessary to have at least once test in this file, so that WebStorm
// detects the file as a test file.
test('cache', () => {});
test('bus', () => {});
test('lock', () => {});
test('queue', () => {});
