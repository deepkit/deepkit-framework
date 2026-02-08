/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { BSONError } from './errors.js';
import { readInt32 } from './reader.js';

/**
 * Streaming BSON message reader.
 *
 * Accepts arbitrary chunks and emits complete BSON documents (by size prefix).
 * Avoids copies when a full document is contained within a single chunk.
 */
export class BSONStreamReader {
    private chunks: Uint8Array[] = [];
    private total: number = 0;

    constructor(private readonly onMessage: (buffer: Uint8Array) => void) {}

    feed(buffer: Uint8Array, length: number = buffer.length): void {
        if (length === 0) return;

        if (this.total === 0) {
            let offset = 0;
            while (offset + 4 <= length) {
                const size = readInt32(buffer, offset);
                if (size <= 0) throw new BSONError('Invalid document size', 'DK-B090');
                if (offset + size <= length) {
                    this.onMessage(buffer.subarray(offset, offset + size));
                    offset += size;
                    continue;
                }
                break;
            }

            if (offset < length) {
                this.chunks.push(buffer.subarray(offset, length));
                this.total = length - offset;
            }
            return;
        }

        this.chunks.push(buffer.subarray(0, length));
        this.total += length;
        this.processChunks();
    }

    emptyBuffer(): boolean {
        return this.total === 0;
    }

    private processChunks(): void {
        while (this.total >= 4) {
            const size = this.peekInt32();
            if (size <= 0) throw new BSONError('Invalid document size', 'DK-B090');
            if (this.total < size) return;
            const message = this.consume(size);
            this.onMessage(message);
        }
    }

    private peekInt32(): number {
        if (this.chunks.length === 0) return 0;
        const first = this.chunks[0];
        if (first.length >= 4) return readInt32(first, 0);

        const tmp = new Uint8Array(4);
        let copied = 0;
        for (const chunk of this.chunks) {
            const remaining = 4 - copied;
            const toCopy = Math.min(remaining, chunk.length);
            tmp.set(chunk.subarray(0, toCopy), copied);
            copied += toCopy;
            if (copied === 4) break;
        }
        return readInt32(tmp, 0);
    }

    private consume(size: number): Uint8Array {
        if (this.chunks.length === 0) return new Uint8Array(0);

        const first = this.chunks[0];
        if (first.length >= size) {
            const result = first.subarray(0, size);
            if (first.length === size) {
                this.chunks.shift();
            } else {
                this.chunks[0] = first.subarray(size);
            }
            this.total -= size;
            return result;
        }

        const result = new Uint8Array(size);
        let written = 0;
        while (written < size && this.chunks.length > 0) {
            const chunk = this.chunks[0];
            const toCopy = Math.min(size - written, chunk.length);
            result.set(chunk.subarray(0, toCopy), written);
            written += toCopy;
            if (toCopy === chunk.length) {
                this.chunks.shift();
            } else {
                this.chunks[0] = chunk.subarray(toCopy);
            }
        }
        this.total -= size;
        return result;
    }
}
