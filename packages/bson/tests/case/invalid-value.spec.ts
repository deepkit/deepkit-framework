import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import bson from 'bson';
import { t } from '@deepkit/type';
import { getBSONDecoder } from '../../src/bson-jit-parser';
import { getBSONSerializer, getBSONSizer } from '../../src/bson-serialize';
const { deserialize, serialize } = bson;

test('invalid', () => {
    const s = t.schema({
        id: t.number,
    });

    {
        const bson = serialize({id: 23});
        expect(getBSONDecoder(s)(bson)).toEqual({id: 23});
    }

    {
        const bson = serialize({id: 'asd'});
        expect(getBSONDecoder(s)(bson)).toEqual({});
    }

    {
        const bson = serialize({});
        expect(getBSONDecoder(s)(bson)).toEqual({});
    }

    {
        const bson = getBSONSerializer(s)({id: 'sd'});
        expect(getBSONDecoder(s)(bson)).toEqual({});
    }

    {
        const bson = getBSONSerializer(s)({id: false});
        expect(getBSONDecoder(s)(bson)).toEqual({});
    }

    {
        const bson = getBSONSerializer(s)({id: {}});
        expect(getBSONDecoder(s)(bson)).toEqual({});
    }

    {
        const bson = getBSONSerializer(s)({id: NaN});
        expect(getBSONDecoder(s)(bson)).toEqual({id: NaN});
    }
});
