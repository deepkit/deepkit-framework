import { bufferConcat } from '@deepkit/core';
import { BSONError } from './model.js';

function readUint32LE(buffer: Uint8Array, offset: number = 0): number {
    return buffer[offset] + (buffer[offset + 1] * 2 ** 8) + (buffer[offset + 2] * 2 ** 16) + (buffer[offset + 3] * 2 ** 24);
}

/**
 * Reads BSON messages from a stream and emits them as Uint8Array.
 */
export class BsonStreamReader {
    protected currentMessage?: Uint8Array;
    protected currentMessageSize: number = 0;

    constructor(
        protected readonly onMessage: (response: Uint8Array) => void,
    ) {
    }

    public emptyBuffer(): boolean {
        return this.currentMessage === undefined;
    }

    public feed(data: Uint8Array, bytes?: number) {
        if (!data.byteLength) return;
        if (!bytes) bytes = data.byteLength;

        if (!this.currentMessage) {
            if (data.byteLength < 4) {
                //not enough data to read the header. Wait for next onData
                this.currentMessage = data;
                this.currentMessageSize = 0;
                return;
            }
            this.currentMessage = data.byteLength === bytes ? data : data.subarray(0, bytes);
            this.currentMessageSize = readUint32LE(data);
        } else {
            this.currentMessage = bufferConcat([this.currentMessage, data.byteLength === bytes ? data : data.subarray(0, bytes)]);
            if (!this.currentMessageSize) {
                if (this.currentMessage.byteLength < 4) {
                    //not enough data to read the header. Wait for next onData
                    return;
                }
                this.currentMessageSize = readUint32LE(this.currentMessage);
            }
            if (this.currentMessage.byteLength < this.currentMessageSize) {
                //not enough data to read the header. Wait for next onData
                return;
            }
        }

        let currentSize = this.currentMessageSize;
        let currentBuffer = this.currentMessage;

        while (currentBuffer) {
            if (currentSize > currentBuffer.byteLength) {
                this.currentMessage = currentBuffer;
                this.currentMessageSize = currentSize;
                //message not completely loaded, wait for next onData
                return;
            }

            if (currentSize === currentBuffer.byteLength) {
                //current buffer is exactly the message length
                this.currentMessageSize = 0;
                this.currentMessage = undefined;
                this.onMessage(currentBuffer);
                return;
            }

            if (currentSize < currentBuffer.byteLength) {
                //we have more messages in this buffer. read what is necessary and hop to next loop iteration
                const message = currentBuffer.subarray(0, currentSize);
                this.onMessage(message);

                currentBuffer = currentBuffer.subarray(currentSize);
                if (currentBuffer.byteLength < 4) {
                    //not enough data to read the header. Wait for next onData
                    this.currentMessage = currentBuffer;
                    this.currentMessageSize = 0;
                    return;
                }

                const nextCurrentSize = readUint32LE(currentBuffer);
                if (nextCurrentSize <= 0) throw new BSONError('message size wrong');
                currentSize = nextCurrentSize;
                //buffer and size has been set. consume this message in the next loop iteration
            }
        }
    }
}

