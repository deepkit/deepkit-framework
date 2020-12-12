import {expect, test} from '@jest/globals';
import {extractParams} from "../src/batcher";

test('batch parse', () => {
    const [first, second, third, left] = extractParams('@batch:0:23:444', 3);
    expect(first).toBe('0');
    expect(second).toBe('23');
    expect(third).toBe('444');
    expect(left).toBe(undefined);
});

test('batch parse left', () => {
    const [first, second, left] = extractParams('@batch:0:23:asasxasasdas', 2);
    expect(first).toBe('0');
    expect(second).toBe('23');
    expect(left).toBe('asasxasasdas');
});
