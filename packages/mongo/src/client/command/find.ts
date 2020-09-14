import {BaseResponse, Command} from './command';
import {ClassSchema, ExtractClassType, getClassSchema, t} from '@deepkit/type';
import {ClassType, toFastProperties} from '@deepkit/core';
import {DEEP_SORT} from '../../query.model';

const findSchema = t.schema({
    find: t.string,
    $db: t.string,
    batchSize: t.number,
    limit: t.number.optional,
    filter: t.any,
    projection: t.any,
    sort: t.any,
    skip: t.number.optional,
});

export class FindCommand<T extends ClassSchema | ClassType> extends Command {

    constructor(
        public classSchema: T,
        public filter: {[name: string]: any} = {},
        public projection?: {[name: string]: 1 | 0},
        public sort?: DEEP_SORT<any>,
        public limit: number = 0,
        public skip: number = 0,
    ) {
        super();
    }

    async execute(config): Promise<ExtractClassType<T>[]> {
        const schema = getClassSchema(this.classSchema);

        const cmd = {
            find: schema.collectionName || schema.name || 'unknown',
            $db: schema.databaseSchemaName || config.defaultDb || 'admin',
            filter: this.filter,
            projection: this.projection,
            sort: this.sort,
            limit: this.limit,
            skip: this.skip,
            batchSize: 200_000, //todo make configurable
        };

        const jit = schema.jit;
        let specialisedResponse = jit.mdbFind;
        if (!specialisedResponse) {
            specialisedResponse = t.schema({
                cursor: {
                    id: t.number,
                    firstBatch: t.array(schema),
                    nextBatch: t.array(schema),
                },
            }, {extend: BaseResponse});
            jit.mdbFind = specialisedResponse;
            toFastProperties(jit);
        }

        const res = await this.sendAndWait(findSchema, cmd, specialisedResponse) as { cursor: { id: BigInt, firstBatch: any[], nextBatch: any[] } };
        //todo: implement fetchMore
        return res.cursor.firstBatch;
    }

    needsWritableHost(): boolean {
        return false;
    }
}