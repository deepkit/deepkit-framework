## Mongo Database for Marshal

[![npm version](https://badge.fury.io/js/%40marcj%2Fmarshal-mongo.svg)](https://badge.fury.io/js/%40marcj%2Fmarshal-mongo)

Marshal's MongoDB database abstraction makes it super easy to
retrieve and store data from and into your MongoDB. We make sure the
data from your JSON or class instance is correctly converted to MongoDB
specific types and inserted IDs are applied to your class instance.

```
npm install @marcj/marshal-mongo reflect-metadata mongodb typeorm
```

Install `buffer` as well if you want binary support.

```typescript
import {plainToClass} from "@marcj/marshal";
import {Database} from "@marcj/marshal-mongo";
import {createConnection} from "typeorm";

(async () => {
const connection = await createConnection({
    type: "mongodb",
    host: "localhost",
    port: 27017,
    database: "testing",
    useNewUrlParser: true,
});
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
});
```
