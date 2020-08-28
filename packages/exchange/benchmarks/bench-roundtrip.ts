import {bench, BenchSuite} from '@super-hornet/core';
import {closeCreatedExchange, createExchange} from '../tests/utils';
import {encodePayloadAsJSONArrayBuffer} from '../src/exchange-prot';


console.log('hi');
(async () => {
    const client = await createExchange();

    await bench(10_000, 'client.set & encode', async () => {
        await client.set('1', encodePayloadAsJSONArrayBuffer({nix: 'data'}));
    });

    await bench(10_000, 'client.get', async () => {
        await client.get('1');
    });

    closeCreatedExchange();

    // const suite = new BenchSuite('Roundtrip');
    // suite.add('232323', () => {
    //     // await client.set('1', encodePayloadAsJSONArrayBuffer({nix: 'data'}));
    // });
    // suite.addAsync('client.set & encode', async () => {
    //     // await client.set('1', encodePayloadAsJSONArrayBuffer({nix: 'data'}));
    // });
    //
    // suite.addAsync('client.get', async () => {
    //     // await client.get('1');
    // });
    //
    // await suite.runAsync();
})();