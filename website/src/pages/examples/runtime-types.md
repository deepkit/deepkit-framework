title: Get all union member as primitive values

```typescript
import { valuesOf } from '@deepkit/type';

type Groups = 'admin' | 'user' | 'guest';

const groups = valuesOf<Groups>(); // ['admin', 'user', 'guest']
```

##-------------------------------------------------##

title: Iterate over class properties

```typescript
import { ReflectionClass } from '@deepkit/type';

class User {
    id: number = 0;
    username: string = '';
    password: string = '';
}

const properties = ReflectionClass.from(User).getProperties();
for (const property of properties) {
    console.log(property.name, property.type);
}
```

##-------------------------------------------------##

title: Convert plain object to class instance

```typescript
import { cast } from '@deepkit/type';

class User {
    firstName: string = '';
    lastName: string = '';

    getFullName() {
        return this.firstName + ' ' + this.lastName;
    }
}

const user = cast<User>({ firstName: 'Peter', lastName: 'Mayer' });
console.log(user.getFullName()); //Peter Mayer
console.log(user instanceof User); //true
```

##-------------------------------------------------##

title: Validate username and email

```typescript
import { Email, MaxLength, MinLength, Pattern, validate } from '@deepkit/type';

type Username = string & MinLength<3> & MaxLength<20> & Pattern<'^[a-zA-Z0-9]+$'>;

class User {
    email: Email = '';
    username: Username = '';
}

const errors = validate<User>({ email: 'peter@example.com', username: 'pet' });
console.log(errors); // [{ path: 'username', message: '...' }]
``` 
