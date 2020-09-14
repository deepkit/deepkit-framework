import {BaseResponse, Command} from './command';
import {ClassSchema, getClassSchema, t} from '@deepkit/type';
import {ClassType} from '@deepkit/core';

class UpdateResponse extends t.class({
    n: t.number,
}, {extend: BaseResponse}) {
}

const updateSchema = t.schema({
    update: t.string,
    $db: t.string,
    updates: t.array({
        q: t.any,
        // maybe in the future support classSchema. But `u` supports update statements https://docs.mongodb.com/manual/reference/operator/update/#id1
        u: t.any,
        multi: t.boolean,
    })
});

export class UpdateCommand<T extends ClassSchema | ClassType> extends Command {
    constructor(
        public classSchema: T,
        public updates: {q: any, u: any, multi: boolean}[] = [],
    ) {
        super();
    }

    async execute(config): Promise<number> {
        const schema = getClassSchema(this.classSchema);

        const cmd = {
            update: schema.collectionName || schema.name || 'unknown',
            $db: schema.databaseSchemaName || config.defaultDb || 'admin',
            updates: this.updates
        };

        const res = await this.sendAndWait(updateSchema, cmd, UpdateResponse);
        return res.n;
    }

    needsWritableHost(): boolean {
        return false;
    }
}