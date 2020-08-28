import {BaseResponse, Command} from './command';
import {ClassSchema, ExtractClassType, getClassSchema, t} from '@super-hornet/marshal';
import {ClassType, toFastProperties} from '@super-hornet/core';

class InsertResponse extends t.class({
    n: t.number,
}, {extend: BaseResponse}) {
}

const insertSchema = t.schema({
    insert: t.string,
    $db: t.string,
});

export class InsertCommand<T extends ClassSchema | ClassType> extends Command {
    constructor(
        protected classSchema: T,
        protected documents: ExtractClassType<T>[]
    ) {
        super();
    }

    async execute(config): Promise<number> {
        const schema = getClassSchema(this.classSchema);

        const cmd = {
            insert: schema.collectionName || schema.name || 'unknown',
            $db: schema.databaseName || config.defaultDb || 'admin',
            documents: this.documents,
        };

        const jit = schema.jit;
        let specialisedSchema = jit.mdbInsert;
        if (!specialisedSchema) {
            specialisedSchema = t.schema({
                documents: t.array(schema)
            }, {extend: insertSchema});
            jit.mdbInsert = specialisedSchema;
            toFastProperties(jit);
        }

        const res = await this.sendAndWait(specialisedSchema, cmd, InsertResponse);
        return res.n;
    }

    needsWritableHost(): boolean {
        return true;
    }
}