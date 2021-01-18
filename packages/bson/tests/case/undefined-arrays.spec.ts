import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import bson from 'bson';
import { getClassSchema, t } from '@deepkit/type';
import { getBSONDecoder } from '../../src/bson-jit-parser';
const { deserialize, serialize } = bson;

test('basic', () => {
    class ProductImage {
        @t path: string = '';
    }

    class Product {
        @t.primary.autoIncrement id: number = 0;

        @t.array(ProductImage) images: ProductImage[] = [];
    }

    {
        const bson = serialize({ id: 23 });
        const item = getBSONDecoder(Product)(bson);
        expect(item.id).toBe(23);
        expect(item.images.length).toBe(0);
    }
});
