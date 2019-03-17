# Core

[![npm version](https://badge.fury.io/js/%40marcj%2Fmarshal.svg)](https://badge.fury.io/js/%40marcj%2Fmarshal)

This is the main module of marshal.

```
npm install @marcj/marshal
```

See the main documentation at [marshal.marcj.dev](https://marshal.marcj.dev) for more information.

### Example

```typescript
import {Entity, Field, plainToClass} from '@marcj/marshal';

class Config {
    @Field()
    ttl?: number;
    
    @Field()
    yes?: boolean;
}

@Entity('myDto')
class Dto {
    @Field()
    name: string;
    
    @Field()
    created: Date = new Date;
    
    @Field([String])
    tags: string[] = [];
    
    @Field(Config)
    tags: Config = new Config;
}

const item = plainToClass({
    name: 'Peter',
    created: "2019-03-17T00:41:49.479Z",
    tags: ['Peter'],
    config: {
        yes: true
    }
});

expect(item).toBeInstanceOf(Dto);
expect(item.created).toBeInstanceOf(Date);
```
