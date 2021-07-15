import 'reflect-metadata';
import { expect, test } from '@jest/globals';
import { createReference, entity, isReference, t } from '@deepkit/type';
import { randomBytes } from 'crypto';
import { getBSONSerializer, getBSONSizer } from '../../src/bson-serialize';
import { getBSONDecoder } from '../../src/bson-jit-parser';
import { ObjectId } from '../../src/model';


test('self-reference', () => {
    @entity.name('explorer/block').collectionName('blocks')
    class ExplorerBlock {
        @t.primary.mongoId public _id!: string;

        @t level: number = 0;
        @t transactions: number = 0;

        constructor(
            @t public hash: Uint8Array,
            @t public created: Date,
            @t.reference().optional public previous?: ExplorerBlock
        ) {
        }
    }

    const blocks: ExplorerBlock[] = [];
    let previous: ExplorerBlock | undefined = undefined;

    for (let i = 0; i < 10; i++) {
        const prev = previous ? createReference(ExplorerBlock, { _id: previous._id }) : undefined;

        previous = new ExplorerBlock(randomBytes(16), new Date, prev);
        previous._id = ObjectId.generate();

        previous.level = Math.ceil(Math.random() * 1000);
        previous.transactions = Math.ceil(Math.random() * 1000);
        blocks.push(previous);
    }

    const serializer = getBSONSerializer(ExplorerBlock);
    const sizer = getBSONSizer(ExplorerBlock);
    const decoder = getBSONDecoder(ExplorerBlock);

    for (const block of blocks) {
        expect(block.level).toBeGreaterThan(0);
        expect(isReference(block)).toBe(false);
        if (block.previous) expect(isReference(block.previous)).toBe(true);

        expect(sizer(block)).toBeGreaterThan(10);
        const bson = serializer(block);
        const back = decoder(bson);

        if (back.previous) expect(typeof back.previous._id).toBe('string');

        expect(back.level).toBe(block.level);
        expect(isReference(back)).toBe(false);
    }
});
