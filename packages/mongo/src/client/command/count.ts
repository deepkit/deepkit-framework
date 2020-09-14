import {BaseResponse, Command} from './command';
import {ClassSchema, getClassSchema, t} from '@deepkit/type';
import {ClassType} from '@deepkit/core';

class CountResponse extends t.class({
    n: t.number,
}, {extend: BaseResponse}) {
}

const countSchema = t.schema({
    count: t.string,
    $db: t.string,
    limit: t.number.optional,
    query: t.any,
    skip: t.number.optional,
});

export class CountCommand<T extends ClassSchema | ClassType> extends Command {
    constructor(
        public classSchema: T,
        public query: { [name: string]: any } = {},
        public limit: number = 0,
        public skip: number = 0,
    ) {
        super();
    }

    async execute(config): Promise<number> {
        const schema = getClassSchema(this.classSchema);

        const cmd = {
            count: schema.collectionName || schema.name || 'unknown',
            $db: schema.databaseSchemaName || config.defaultDb || 'admin',
            query: this.query,
            limit: this.limit,
            skip: this.skip,
        };

        const res = await this.sendAndWait(countSchema, cmd, CountResponse);
        return res.n;
    }

    needsWritableHost(): boolean {
        return false;
    }
}