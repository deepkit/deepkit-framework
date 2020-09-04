import {BaseResponse, Command} from './command';
import {ClassSchema, ExtractClassType, getClassSchema, t} from '@super-hornet/marshal';
import {ClassType, toFastProperties} from '@super-hornet/core';

const aggregateSchema = t.schema({
    aggregate: t.string,
    $db: t.string,
    pipeline: t.array(t.any),
    cursor: {
        batchSize: t.number,
    }
});

export class AggregateCommand<T extends ClassSchema | ClassType, R extends ClassSchema> extends Command {
    constructor(
        public classSchema: T,
        public pipeline: any[] = [],
        public resultSchema?: R,
    ) {
        super();
    }

    async execute(config): Promise<ExtractClassType<R extends undefined ? T : R>[]> {
        const schema = getClassSchema(this.classSchema);

        const cmd = {
            aggregate: schema.collectionName || schema.name || 'unknown',
            $db: schema.databaseName || config.defaultDb || 'admin',
            pipeline: this.pipeline,
            cursor: {
                batchSize: 20000,
            }
        };

        const resultSchema = this.resultSchema || schema;

        const jit = resultSchema.jit;
        let specialisedResponse = jit.mdbAggregate;
        if (!specialisedResponse) {
            specialisedResponse = t.schema({
                cursor: {
                    id: t.number,
                    firstBatch: t.array(resultSchema),
                    nextBatch: t.array(resultSchema),
                },
            }, {extend: BaseResponse});
            jit.mdbAggregate = specialisedResponse;
            toFastProperties(jit);
        }

        const res = await this.sendAndWait(aggregateSchema, cmd, specialisedResponse) as { cursor: { id: BigInt, firstBatch: any[], nextBatch: any[] } };

        //todo: implement fetchMore
        return res.cursor.firstBatch;
    }

    needsWritableHost(): boolean {
        return false;
    }
}