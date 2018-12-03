
## Mongo Database for Marshal

Marshal's MongoDB database abstraction makes it super easy to
retrieve and store data from and into your MongoDB. We make sure the
data from your JSON or class instance is correctly converted to MongoDB
specific types and inserted IDs are applied to your class instance.

```
npm install @marcj/marshal-mongo
```

```typescript
import {MongoClient} from "mongodb";
import {plainToClass} from "@marcj/marshal";
import {Database} from "@marcj/marshal-mongo";

const connection = await MongoClient.connect(
    'mongodb://localhost:27017', 
    {useNewUrlParser: true}
);
await connection.db('testing').dropDatabase();
const database = new Database(connection, 'testing');

const instance: SimpleModel = plainToClass(SimpleModel, {
    id: 'f2ee05ad-ca77-49ea-a571-8f0119e03038',
    name: 'myName',
});

await database.save(SimpleModel, instance);

const list: SimpleModel[] = await database.find(SimpleModel);
const oneItem: SimpleModel = await database.get(
    SimpleModel,
    {id: 'f2ee05ad-ca77-49ea-a571-8f0119e03038'}
);
```