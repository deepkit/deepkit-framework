# Marshal BSON

`@super-hornet/marshal-bson` is a high-performance TS implementation of a parser and serializer for BSON,
 the MongoDB Binary JSON format. It's the fastest JS BSON parser, even faster than native JSON.parse/stringify.
 
Super Hornet has reimplemented it because its a high-performane framework and both the official JS (js-bson) and C++ (bson-ext) packages are too slow. 
How slow? When converting 10k elements in an array, js-bson takes 25ms, bson-ext takes 31ms, whiles JSON.parse takes only 5ms. 
This makes the official BSON parser 5x slower than native JSON.parse. Marshal-bson on the other hand takes only 2ms and is therefore 13x faster.

### Benchmark

**Parsing** BSON buffer that contains an array with 10k objects.

| Method | Time (ms) |
| ------ | --------: |
| official native bson-ext |  31ms | 
| official js-bson |  25ms | 
| Marshal generic v2 |  6ms | 
| Marshal generic v3 |  4ms | 
| JSON.parse |  5ms | 
| Marshal JIT | 2ms |


**Serializing** an array with 10k objects.

| Method | Time (ms) |
| ------ | --------: |
| official native bson-ext |  39ms | 
| official js-bson |  33ms | 
| JSON.stringify |  5ms | 
| Marshal JIT | 2ms |

"Marshal JIT" means a parser/serializer based on a schema like so:

```typescript
import {t} from '@super-hornet/marshal';
import {getBSONDecoder} from '@super-hornet/marshal-bson';

const schema = t.schema({
    username: t.string,
    tags: t.array(t.string),
    priority: t.number,
});

const decoder = getBSONDecoder(schema);
const bson = new Buffer([]);

const document = decoder(bson);
``` 

whereas "Marshal generic" means schema-less:

```typescript
import {parseObject, ParserV2, ParserV3} from '@super-hornet/marshal-bson';
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
