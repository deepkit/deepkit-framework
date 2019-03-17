# Core

[![npm version](https://badge.fury.io/js/%40marcj%2Fmarshal.svg)](https://badge.fury.io/js/%40marcj%2Fmarshal)

This is the main module of marshal.

```
npm install @marcj/marshal
```


### Example

```typescript
import {Entity, StringType, DateType, plainToClass} from '@marcj/marshal';

@Entity()
class Dto {
    @StringType()
    name: string;
    
    @DateType()
    created: Date = new Date;
}

const item = plainToClass({
    name: 'Peter',
    created: "2019-03-17T00:41:49.479Z"
});

expect(item).toBeInstanceOf(Dto);
expect(item.created).toBeInstanceOf(Date);
```
