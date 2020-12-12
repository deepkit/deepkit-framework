# BSON

`@deepkit/bson` is a high-performance TS implementation of a parser and serializer for BSON,
 the MongoDB Binary JSON format. It's the fastest JS BSON parser, even faster than native JSON.parse/stringify.
 
Deepkit has reimplemented it because its a high-performane framework and both the official JS (js-bson) and C++ (bson-ext) packages are too slow. 
How slow? When converting 10k elements in an array, js-bson takes 25ms, bson-ext takes 31ms, whiles JSON.parse takes only 5ms. 
This makes the official BSON parser 5x slower than native JSON.parse. deepkit/type-bson on the other hand takes only 2ms and is therefore 13x faster.

### Benchmark

**Parsing** BSON buffer that contains an array with 10k objects.

| Method | Time (ms) |
| ------ | --------: |
| official native bson-ext |  31ms | 
| official js-bson |  25ms | 
| deepkit/bson generic v2 |  6ms | 
| deepkit/bson generic v3 |  4ms | 
| JSON.parse |  5ms | 
| deepkit/type JIT | 2ms |


**Serializing** an array with 10k objects.

| Method | Time (ms) |
| ------ | --------: |
| official native bson-ext |  39ms | 
| official js-bson |  33ms | 
| JSON.stringify |  5ms | 
| deepkit/bson JIT | 2ms |

"deepkit/bson JIT" means a parser/serializer based on a schema like so:

```typescript
import {t} from '@deepkit/type';
import {getBSONDecoder} from '@deepkit/bson';

const schema = t.schema({
    username: t.string,
    tags: t.array(t.string),
    priority: t.number,
});

const decoder = getBSONDecoder(schema);
const bson = new Buffer([]);

const document = decoder(bson);
``` 

whereas "deepkit/type generic" means schema-less:

```typescript
import {parseObject, ParserV2, ParserV3} from '@deepkit/bson';
const bson = new Buffer([]);

const object1 = parseObject(new ParserV2(bson));

const object2 = parseObject(new ParserV3(bson));
```

### Differences

There are a couple of differences to the official serializer.

- ObjectId is deserialized as string.
- UUID is deserialized as string.
- BigInt is supported and serialized as long. 
- Long is deserialized as BigInt.
- Moment is serialized as long (like Date).
