import 'reflect-metadata';
import { expect, test } from '@jest/globals';
import { t } from '../src/decorators';
import { getClassSchema } from '../src/model';
import { getConverterForSnapshot, getPrimaryKeyExtractor, getPrimaryKeyHashGenerator, snapshotSerializer } from '../src/snapshot';
import { jsonSerializer } from '../src/json-serializer';

class Image {
    @t title: string = '';

    constructor(@t.primary public id: number = 0) {
    }
}

class User {
    @t.reference().optional image?: Image;

    @t title: string = '';

    constructor(@t.primary public id: number = 0) {

    }
}

test('benchmark', () => {
});

test('getJITConverterForSnapshot', () => {
    const schema = getClassSchema(User);
    const converter = getConverterForSnapshot(schema);

    {
        const converted = converter({ id: 22, title: 'Peter' });
        expect(converted).toBeInstanceOf(Object);
        expect(converted).toEqual({ id: 22, title: 'Peter', image: null });
    }

    {
        const converted = converter({ id: 22, title: 'Peter', image: new Image(3) });
        expect(converted).toBeInstanceOf(Object);
        expect(converted).toEqual({ id: 22, title: 'Peter', image: { id: 3 } });
    }
});


test('getPrimaryKeyExtractor', () => {
    const schema = getClassSchema(User);
    const converter = getPrimaryKeyExtractor(schema);

    {
        const converted = converter({ id: 22, title: 'Peter' });
        expect(converted).toBeInstanceOf(Object);
        expect(converted).toEqual({ id: 22 });
    }

    {
        const converted = converter({ id: 22, title: 'Peter', image: new Image(3) });
        expect(converted).toBeInstanceOf(Object);
        expect(converted).toEqual({ id: 22 });
    }
});

test('getPrimaryKeyHashGenerator', () => {
    const schema = getClassSchema(User);
    expect(schema.getPrimaryFields().length).toBe(1);
    const converter = getPrimaryKeyHashGenerator(schema, jsonSerializer);

    {
        const converted = converter({ id: 22, title: 'Peter' });
        expect(converted).toBe('\u000022');
    }

    {
        const converted = converter({ id: 22, title: 'Peter', image: new Image(3) });
        expect(converted).toBe('\u000022');
    }
});

test('bigint and binary', () => {
    class Node {
        @t stake: bigint = 0n;

        constructor(
            @t.primary public publicKey: Uint8Array,
        ) {
        }
    }

    const schema = getClassSchema(Node);
    expect(schema.getPrimaryFields().length).toBe(1);

    const snapshot = getConverterForSnapshot(schema);
    const converter = getPrimaryKeyHashGenerator(schema, jsonSerializer);
    const pkExtract = getPrimaryKeyExtractor(schema);

    {
        const converted = converter({ publicKey: new Uint8Array([0, 1, 2, 3]) });
        expect(converted).toBe('\u0000AAECAw==');
    }

    {
        const converted = snapshot({ publicKey: new Uint8Array([0, 1, 2, 3]), stake: 12n });
        expect(converted).toEqual({ publicKey: 'AAECAw==', stake: 12n });

        const back = snapshotSerializer.for(schema).deserialize(converted);
        expect(back.stake).toBe(12n);
        expect(back.publicKey).toBeInstanceOf(Uint8Array);
        expect(Array.from(back.publicKey as any)).toEqual([0, 1, 2, 3]);

        const pk = pkExtract(converted);
        expect(pk.publicKey).toBeInstanceOf(Uint8Array);
        expect(Array.from(pk.publicKey as any)).toEqual([0, 1, 2, 3]);
    }
});

test('bigint primary key', () => {
    class Node {
        constructor(
            @t.primary public stake: bigint,
        ) {
        }
    }

    const schema = getClassSchema(Node);
    expect(schema.getPrimaryFields().length).toBe(1);

    const snapshot = getConverterForSnapshot(schema);
    const converter = getPrimaryKeyHashGenerator(schema, jsonSerializer);
    const pkExtract = getPrimaryKeyExtractor(schema);

    {
        const converted = converter({ stake: 12n });
        expect(converted).toBe('\u000012');
    }

    {
        const converted = snapshot({ stake: 12n });
        expect(converted).toEqual({ stake: 12n });

        const back = snapshotSerializer.for(schema).deserialize(converted);
        expect(back.stake).toBe(12n);

        const pk = pkExtract(converted);
        expect(pk.stake).toBe(12n);
    }
});
