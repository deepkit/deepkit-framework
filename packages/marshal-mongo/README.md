## Mongo Database for Marshal

[![npm version](https://badge.fury.io/js/%40marcj%2Fmarshal-mongo.svg)](https://badge.fury.io/js/%40marcj%2Fmarshal-mongo)

Marshal's MongoDB database abstraction makes it super easy to
retrieve and store data from and into your MongoDB. We make sure the
data from your JSON or class instance is correctly converted to MongoDB
specific types and inserted IDs are applied to your class instance.

```
npm install @super-hornet/marshal @super-hornet/marshal-mongo reflect-metadata mongodb
```

```typescript

import {Database, Connection} from "@super-hornet/marshal-mongo";

const database = new Database(new Connection('localhost', 'mydb', 'username', 'password'));

const instance = new SimpleModel('My model');
await database.add(instance);

const list = await database.query(SimpleModel).find();
const oneItem = await database.query(SimpleModel).filter({id: 'f2ee05ad-ca77-49ea-a571-8f0119e03038'}).findOne();

```
