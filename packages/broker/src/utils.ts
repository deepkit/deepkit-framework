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

export function handleMessageDeduplication(hash: string | number, queue: Queue, value: Uint8Array, ttl: number): boolean {
    if (queue.deduplicateMessageHashes.has(hash)) return true;
    setTimeout(() => queue.deduplicateMessageHashes.delete(hash), ttl);
    queue.deduplicateMessageHashes.add(hash);
    return false;
}
