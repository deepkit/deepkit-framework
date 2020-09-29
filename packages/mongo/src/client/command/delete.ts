import {BaseResponse, Command} from './command';
import {ClassSchema, getClassSchema, t} from '@deepkit/type';
import {ClassType} from '@deepkit/core';

class DeleteResponse extends t.extendClass(BaseResponse, {
    n: t.number,
}) {
}

const deleteSchema = t.schema({
    delete: t.string,
    $db: t.string,
    deletes: t.array({
        q: t.any,
        limit: t.number,
    }),
});

export class DeleteCommand<T extends ClassSchema | ClassType> extends Command {

    constructor(
        public classSchema: T,
        public filter: { [name: string]: any } = {},
        public limit: number = 0,
        public skip: number = 0,
    ) {
        super();
    }

    async execute(config): Promise<number> {
        const schema = getClassSchema(this.classSchema);

        const cmd = {
            delete: schema.collectionName || schema.name || 'unknown',
            $db: schema.databaseSchemaName || config.defaultDb || 'admin',
            deletes: [
                {
                    q: this.filter,
                    limit: this.limit,
                }
            ]
        };

        const res = await this.sendAndWait(deleteSchema, cmd, DeleteResponse);
        return res.n;
    }

    needsWritableHost(): boolean {
        return false;
    }
}
