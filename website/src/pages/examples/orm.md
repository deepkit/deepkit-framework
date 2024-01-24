title: User Entity with Password Hashing

```typescript
import * as bcrypt from 'bcrypt';

import { Database } from '@deepkit/orm';
import { AutoIncrement, PrimaryKey, cast, entity } from '@deepkit/type';

@entity.collection('users')
class User {
  id: number & PrimaryKey & AutoIncrement = 0;
  password: string = '';

  constructor(public username: string & Unique) {}
}

async function addUser(data: Partial<User>, database: Database) {
  const user = cast<User>(data);
  user.password = await bcrypt.hash(user.password, 10);
  await database.persist(user);
}
```

##-------------------------------------------------##

title: Handle unique constraint violation

```typescript
import {entity, PrimaryKey, Database, Unique} from "@deepkit/type";
import {Database, UniqueConstraintFailure} from '@deepkit/orm';

@entity.collection('users')
class User {
    id: number & PrimaryKey = 0;
    constructor(public username: string & Unique) {}
}

async function addUser(data: Partial<User>, database: Database) {
    const user = cast<User>(data);

    try {
        await database.persist(user);
    } catch (error: any) {
        if (error instanceof UniqueConstraintFailure) {
            throw new Error('Username already taken');
        }
        throw error;
    }
}
```
