import { parse } from '@lukeed/ms';
import { xxHash32 } from 'js-xxhash';

export function parseTime(value?: string | number): number | undefined {
    if ('undefined' === typeof value) return;
    if ('string' === typeof value) return value ? parse(value) || 0 : undefined;
    return value;
}

export function fastHash(value: Uint8Array): string {
    return xxHash32(value).toString(16);
}
