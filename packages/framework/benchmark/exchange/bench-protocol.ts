import {BenchSuite} from '@deepkit/core';
import {decodeMessage, encodeMessage, encodePayloadAsJSONArrayBuffer} from '../../src/exchange/exchange-prot';

const payload = encodePayloadAsJSONArrayBuffer({data: true});

const bench = new BenchSuite('Encode/Decode exchange');
let i = 0;

bench.add('encodeMessage', () => {
    encodeMessage(i++, 'publish', 'channel-name', payload);
});

i = 0;
const m = encodeMessage(i++, 'publish', 'channel-name', payload);
bench.add('decodeMessage', () => {
    decodeMessage(m);
});

i = 0;
const m2 = encodeMessage(i++, 'publish', 'channel-name');
bench.add('decodeMessage no-payload', () => {
    decodeMessage(m2);
});

i = 0;
bench.add('encodeMessage no-payload', () => {
    encodeMessage(i++, 'publish', 'channel-name');
});
i = 0;
bench.add('wtf2', () => {
    i++;
});

i = 0;
bench.add('wtf3', () => {
    const b = {id: i++, t: 'publish', ready: 1};
});

// const schema = t.schema({
//     id: t.number,
//     t: t.string,
//     ready: t.boolean,
// });
// const schemaSerialize = getBSONSerializer(schema);
// const schemaSizer = createBSONSizer(schema);
//
// i = 0;
// bench.add('BSON schemaSizer no-payload', () => {
//     schemaSizer({id: i++, t: 'publish', ready: 1});
// });
//
// i = 0;
// bench.add('BSON serialize no-payload', () => {
//     schemaSerialize({id: i++, t: 'publish', ready: 1});
// });
//
// const bson = schemaSerialize({id: i++, t: 'publish', ready: 3});
// const decoder = getBSONDecoder(schema);
// bench.add('BSON decode no-payload', () => {
//     decoder(bson);
// });

bench.run();