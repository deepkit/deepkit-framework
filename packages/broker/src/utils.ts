import { parse } from '@lukeed/ms';

export function parseTime(value?: string | number): number | undefined {
    if ('undefined' === typeof value) return;
    if ('string' === typeof value) return value ? parse(value) || 0 : undefined;
    return value;
}
