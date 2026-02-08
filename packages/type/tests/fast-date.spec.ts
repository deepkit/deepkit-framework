import { test } from 'node:test';

import { expect } from '@deepkit/run/expect';

import { FastDate } from '../src/fast-date.js';

test('construction with ms', () => {
    const ms = 1705314600000;
    const fd = new FastDate(ms);
    expect(fd.getTime()).toBe(ms);
    expect(fd.valueOf()).toBe(ms);
});

test('no-arg constructor gives current time', () => {
    const before = Date.now();
    const fd = new FastDate();
    const after = Date.now();
    // FastDate() should be within the Date.now() window
    expect(fd.getTime()).toBeGreaterThanOrEqual(before);
    expect(fd.getTime()).toBeLessThanOrEqual(after + 1); // +1ms tolerance
});

test('instanceof Date', () => {
    const fd = new FastDate(1705314600000);
    expect(fd instanceof Date).toBe(true);
    expect(fd instanceof FastDate).toBe(true);
});

test('real Date still passes instanceof', () => {
    const d = new Date();
    expect(d instanceof Date).toBe(true);
});

test('non-dates fail instanceof', () => {
    expect('hello' instanceof (Date as any)).toBe(false);
    expect((42 as any) instanceof Date).toBe(false);
    expect(({} as any) instanceof Date).toBe(false);
    expect(null instanceof (Date as any)).toBe(false);
});

test('getTime / valueOf fast path', () => {
    const ms = 1705314600123;
    const fd = new FastDate(ms);
    expect(fd.getTime()).toBe(ms);
    expect(fd.valueOf()).toBe(ms);
    expect(+fd).toBe(ms);
});

test('toISOString matches real Date', () => {
    const ms = 1705314600000;
    const fd = new FastDate(ms);
    const d = new Date(ms);
    expect(fd.toISOString()).toBe(d.toISOString());
});

test('toJSON matches real Date', () => {
    const ms = 1705314600000;
    const fd = new FastDate(ms);
    const d = new Date(ms);
    expect(fd.toJSON()).toBe(d.toJSON());
    expect(JSON.stringify({ d: fd })).toBe(JSON.stringify({ d: d }));
});

test('toString matches real Date', () => {
    const ms = 1705314600000;
    const fd = new FastDate(ms);
    const d = new Date(ms);
    expect(fd.toString()).toBe(d.toString());
});

test('toUTCString matches real Date', () => {
    const ms = 1705314600000;
    const fd = new FastDate(ms);
    const d = new Date(ms);
    expect(fd.toUTCString()).toBe(d.toUTCString());
});

test('toDateString matches real Date', () => {
    const ms = 1705314600000;
    const fd = new FastDate(ms);
    const d = new Date(ms);
    expect(fd.toDateString()).toBe(d.toDateString());
});

test('toTimeString matches real Date', () => {
    const ms = 1705314600000;
    const fd = new FastDate(ms);
    const d = new Date(ms);
    expect(fd.toTimeString()).toBe(d.toTimeString());
});

test('local time getters match real Date', () => {
    const ms = 1705314600123;
    const fd = new FastDate(ms);
    const d = new Date(ms);
    expect(fd.getFullYear()).toBe(d.getFullYear());
    expect(fd.getMonth()).toBe(d.getMonth());
    expect(fd.getDate()).toBe(d.getDate());
    expect(fd.getDay()).toBe(d.getDay());
    expect(fd.getHours()).toBe(d.getHours());
    expect(fd.getMinutes()).toBe(d.getMinutes());
    expect(fd.getSeconds()).toBe(d.getSeconds());
    expect(fd.getMilliseconds()).toBe(d.getMilliseconds());
});

test('UTC getters match real Date', () => {
    const ms = 1705314600123;
    const fd = new FastDate(ms);
    const d = new Date(ms);
    expect(fd.getUTCFullYear()).toBe(d.getUTCFullYear());
    expect(fd.getUTCMonth()).toBe(d.getUTCMonth());
    expect(fd.getUTCDate()).toBe(d.getUTCDate());
    expect(fd.getUTCDay()).toBe(d.getUTCDay());
    expect(fd.getUTCHours()).toBe(d.getUTCHours());
    expect(fd.getUTCMinutes()).toBe(d.getUTCMinutes());
    expect(fd.getUTCSeconds()).toBe(d.getUTCSeconds());
    expect(fd.getUTCMilliseconds()).toBe(d.getUTCMilliseconds());
});

test('getTimezoneOffset matches real Date', () => {
    const ms = 1705314600000;
    const fd = new FastDate(ms);
    const d = new Date(ms);
    expect(fd.getTimezoneOffset()).toBe(d.getTimezoneOffset());
});

test('setTime updates ms and invalidates cache', () => {
    const fd = new FastDate(1705314600000);
    const newMs = 1705400000000;
    const ret = fd.setTime(newMs);
    expect(ret).toBe(newMs);
    expect(fd.getTime()).toBe(newMs);
    expect(fd.toISOString()).toBe(new Date(newMs).toISOString());
});

test('setFullYear updates correctly', () => {
    const fd = new FastDate(1705314600000);
    fd.setFullYear(2020);
    const d = new Date(1705314600000);
    d.setFullYear(2020);
    expect(fd.getTime()).toBe(d.getTime());
    expect(fd.getFullYear()).toBe(2020);
});

test('setMonth updates correctly', () => {
    const fd = new FastDate(1705314600000);
    fd.setMonth(5);
    const d = new Date(1705314600000);
    d.setMonth(5);
    expect(fd.getTime()).toBe(d.getTime());
});

test('setDate updates correctly', () => {
    const fd = new FastDate(1705314600000);
    fd.setDate(25);
    const d = new Date(1705314600000);
    d.setDate(25);
    expect(fd.getTime()).toBe(d.getTime());
});

test('setHours updates correctly', () => {
    const fd = new FastDate(1705314600000);
    fd.setHours(10, 30, 45, 500);
    const d = new Date(1705314600000);
    d.setHours(10, 30, 45, 500);
    expect(fd.getTime()).toBe(d.getTime());
});

test('UTC setters update correctly', () => {
    const fd = new FastDate(1705314600000);
    fd.setUTCFullYear(2020);
    const d = new Date(1705314600000);
    d.setUTCFullYear(2020);
    expect(fd.getTime()).toBe(d.getTime());

    fd.setUTCMonth(3);
    d.setUTCMonth(3);
    expect(fd.getTime()).toBe(d.getTime());

    fd.setUTCDate(10);
    d.setUTCDate(10);
    expect(fd.getTime()).toBe(d.getTime());

    fd.setUTCHours(8, 15, 30, 250);
    d.setUTCHours(8, 15, 30, 250);
    expect(fd.getTime()).toBe(d.getTime());
});

test('Symbol.toPrimitive number hint', () => {
    const ms = 1705314600000;
    const fd = new FastDate(ms);
    expect(+fd).toBe(ms);
    expect(fd > new FastDate(ms - 1000)).toBe(true);
    expect(fd < new FastDate(ms + 1000)).toBe(true);
});

test('Symbol.toPrimitive string hint', () => {
    const ms = 1705314600000;
    const fd = new FastDate(ms);
    const d = new Date(ms);
    expect(`${fd}`).toBe(d.toString());
});

test('comparison with real Date', () => {
    const ms = 1705314600000;
    const fd = new FastDate(ms);
    const d = new Date(ms);
    expect(+fd).toBe(+d);
    expect(+fd === +d).toBe(true);
});

test('JSON.stringify produces same output as real Date', () => {
    const ms = 1705314600000;
    const obj1 = { created: new FastDate(ms), name: 'test' };
    const obj2 = { created: new Date(ms), name: 'test' };
    expect(JSON.stringify(obj1)).toBe(JSON.stringify(obj2));
});

test('setTime then setFullYear works (cache invalidation chain)', () => {
    const fd = new FastDate(1705314600000);
    fd.setTime(0); // epoch
    expect(fd.getTime()).toBe(0);
    fd.setFullYear(2025);
    expect(fd.getFullYear()).toBe(2025);
    // Verify the underlying date is consistent
    expect(fd.toISOString()).toBe(new Date(fd.getTime()).toISOString());
});

test('multiple FastDate instances are independent', () => {
    const fd1 = new FastDate(1000);
    const fd2 = new FastDate(2000);
    expect(fd1.getTime()).toBe(1000);
    expect(fd2.getTime()).toBe(2000);
    fd1.setTime(3000);
    expect(fd1.getTime()).toBe(3000);
    expect(fd2.getTime()).toBe(2000);
});

test('epoch zero', () => {
    const fd = new FastDate(0);
    const d = new Date(0);
    expect(fd.toISOString()).toBe(d.toISOString());
    expect(fd.getTime()).toBe(0);
});

test('negative timestamp', () => {
    const ms = -86400000; // one day before epoch
    const fd = new FastDate(ms);
    const d = new Date(ms);
    expect(fd.toISOString()).toBe(d.toISOString());
    expect(fd.getTime()).toBe(ms);
    expect(fd.getFullYear()).toBe(d.getFullYear());
});
