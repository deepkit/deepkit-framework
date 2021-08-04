import { expect, test } from '@jest/globals';
import { t } from '../src/decorators';
import { plainToClass } from '../src/json-serializer';
import { validates } from '../index';

test('bigint from non bigint', () => {
    const schema = t.schema({
        total: t.bigint,
    });

    expect(plainToClass(schema, { total: 100n }).total).toBe(100n);
    expect(plainToClass(schema, { total: 100 }).total).toBe(100n);
    expect(plainToClass(schema, { total: '100' }).total).toBe(100n);
    expect(plainToClass(schema, { total: '0xff' }).total).toBe(255n);
    expect(plainToClass(schema, { total: '0' }).total).toBe(0n);
    expect(plainToClass(schema, { total: '0x0' }).total).toBe(0n);

    expect(validates(schema, plainToClass(schema, { total: 100n }))).toBe(true);
    expect(validates(schema, plainToClass(schema, { total: 100 }))).toBe(true);
    expect(validates(schema, plainToClass(schema, { total: '100' }))).toBe(true);
    expect(validates(schema, plainToClass(schema, { total: '0xff' }))).toBe(true);
    expect(validates(schema, plainToClass(schema, { total: '0' }))).toBe(true);
    expect(validates(schema, plainToClass(schema, { total: '0x0' }))).toBe(true);

    expect(validates(schema, { total: 100n })).toBe(true);
    expect(validates(schema, { total: 100 })).toBe(false);
    expect(validates(schema, { total: '100' })).toBe(false);
    expect(validates(schema, { total: '0xff' })).toBe(false);
    expect(validates(schema, { total: '0' })).toBe(false);
    expect(validates(schema, { total: '0x0' })).toBe(false);
});

test('bigint validation', () => {
    const schema = t.schema({
        total: t.bigint,
    });

    expect(validates(schema, { total: 100n })).toBe(true);
    expect(validates(schema, { total: '100' })).toBe(false);
    expect(validates(schema, { total: 100 })).toBe(false);
});
