# NestJS / Express for Marshal

[![npm version](https://badge.fury.io/js/%40marcj%2Fmarshal-nest.svg)](https://badge.fury.io/js/%40marcj%2Fmarshal-nest)

It's super common to accept data from a frontend via HTTP, transform the
body into your class instance, work with it, and then store that data in
your MongoDB or somewhere else. With Marshal this scenario is super
simple and you do not need any manual transformations.

```
npm install @marcj/marshal @marcj/marshal-mongo @marcj/marshal-nest
```

```typescript
import {
    Controller, Get, Param, Post, Body
} from '@nestjs/common';

import {SimpleModel} from "@marcj/marshal/tests/entities";
import {plainToClass, Database, classToPlain} from "@marcj/marshal";
import {ValidationPipe} from "@marcj/marshal-nest";
import {createConnection} from "typeorm";

@Controller()
class MyController {
    
    private database: Database;
    
    private async getDatabase() {
        if (!this.database) {
            const connection = await createConnection({
                type: "mongodb",
                host: "localhost",
                port: 27017,
                database: "testing",
                useNewUrlParser: true,
            });
            this.database = new Database(connection, 'testing');
        }
        
        return this.database;
    }
    
    @Post('/save')
    async save(
        @Body(ValidationPipe({transform: true})) body: SimpleModel,
    ) {
        body instanceof SimpleModel; // true;

        await (await this.getDatabase()).save(SimpleModel, body);
        
        return body.id;
    }
    
    @Get('/get/:id')
    async get(@Param('id') id: string) {
        const instance = await (await this.getDatabase()).get(SimpleModel, {_id: id});

        return classToPlain(SimpleModel, instance);
    }
}

````
