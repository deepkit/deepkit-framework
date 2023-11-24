import { parse } from '@lukeed/ms';
import { xxHash32 } from 'js-xxhash';

import { Queue } from './kernel.js';

export function parseTime(value?: string | number): number | undefined {
    if ('undefined' === typeof value) return;
    if ('string' === typeof value) return value ? parse(value) || 0 : undefined;
    return value;
}

export function fastHash(value: Uint8Array): number {
    return xxHash32(value);
}

export function handleMessageDeduplication(queue: Queue, value: Uint8Array, ttl: number): boolean {
    const key = fastHash(value);
    if (queue.deduplicateMessageHashes.has(key)) return true;
    setTimeout(() => queue.deduplicateMessageHashes.delete(key), ttl);
    queue.deduplicateMessageHashes.add(key);
    return false;
}
