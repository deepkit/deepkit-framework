/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { BehaviorSubject, Subject, Subscriber, Subscription, SubscriptionLike } from 'rxjs';
import { rpcChunk, RpcTypes } from './model.js';
import { createRpcMessage, readRpcMessage, RpcMessageReader } from './protocol.js';
import type { RpcConnectionWriter } from './server/kernel.js';

export class SingleProgress extends Subject<SingleProgress> {
    public done = false;

    public total = 0;
    public current = 0;
    public stats = 0;

    protected lastTime = 0;

    protected triggerFinished?: Function;
    finished = new Promise((resolve) => {
        this.triggerFinished = resolve;
    });

    constructor() {
        super();
    }

    /**
     * Acts like a BehaviorSubject.
     */
    _subscribe(subscriber: Subscriber<SingleProgress>): Subscription {
        //Subject does not expose protected _subscribe anymore, so we have to use prototype directly
        const subscription = (Subject as any).prototype._subscribe.apply(this, [subscriber]);
        if (subscription && !(<SubscriptionLike>subscription).closed) {
            subscriber.next(this);
        }
        return subscription;
    }

    public setStart(total: number) {
        this.total = total;
        this.lastTime = Date.now();
    }


    public setBatch(size: number) {
        this.current += size;
        this.lastTime = Date.now();
    }

    get progress(): number {
        if (this.done) return 1;
        if (this.total === 0) return 0;
        return this.current / this.total;
    }

    set(total: number, current: number) {
        if (this.done) return;
        this.total = total;
        this.current = current;
        this.done = total === current;
        this.stats++;
        this.next(this);
        if (this.done) {
            this.complete();
            if (this.triggerFinished) this.triggerFinished();
        }
    }
}

export class Progress extends BehaviorSubject<number> {
    public readonly upload = new SingleProgress;
    public readonly download = new SingleProgress;

    constructor() {
        super(0);
    }
}

export class RpcMessageWriterOptions {
    /**
     * Stores big buffers to the file system and stream it from there.
     * In bytes.
     * note: not implemented yet
     */
    public cacheOnFileSystemWhenSizeIsAtLeast: number = 100_000_000;

    /**
     * When back-pressure is bigger than this value, we wait with sending new data.
     * In bytes.
     * note: not implemented yet
     */
    public stepBackWhenBackPressureBiggerThan: number = 5_000_000;

    /**
     * Chunk size.
     * In bytes.
     */
    public chunkSize: number = 100_000;

}

/**
 * This class acts as a layer between kernel/client and a connection writer.
 * It automatically chunks long messages into multiple smaller one using the RpcType.Chunks type.
 *
 * todo:
 * It keeps track of the back-pressure and sends only when the pressure is not too big.
 * It automatically saves big buffer to the file system and streams data from there to not
 * block valuable memory.
 */
export class RpcMessageWriter implements RpcConnectionWriter {
    protected chunkId = 0;

    constructor(
        protected writer: RpcConnectionWriter,
        protected reader: RpcMessageReader,
        protected options: RpcMessageWriterOptions
    ) {
    }

    close(): void {
        this.writer.close();
    }

    write(buffer: Uint8Array, progress?: SingleProgress): void {
        this.writeFull(buffer, progress).catch(error => console.log('RpcMessageWriter writeAsync error', error));
    }

    async writeFull(buffer: Uint8Array, progress?: SingleProgress): Promise<void> {
        if (buffer.byteLength >= this.options.chunkSize) {
            //split up
            const chunkId = this.chunkId++;
            const message = readRpcMessage(buffer); //we need the original message-id, so the chunks are correctly assigned in Progress tracker
            let offset = 0;
            while (offset < buffer.byteLength) {
                //todo: check back-pressure and wait if necessary
                const slice = buffer.slice(offset, offset + this.options.chunkSize);
                const chunkMessage = createRpcMessage<rpcChunk>(message.id, RpcTypes.Chunk, {
                    id: chunkId,
                    total: buffer.byteLength,
                    v: slice
                });
                offset += slice.byteLength;
                const promise = new Promise((resolve) => {
                    this.reader.onChunkAck(message.id, resolve);
                });
                this.writer.write(chunkMessage);
                await promise;
                progress?.set(buffer.byteLength, offset);
            }
        } else {
            this.writer.write(buffer);
            progress?.set(buffer.byteLength, buffer.byteLength);
        }
    }
}

export class ClientProgress {
    static nextProgress?: Progress;

    /**
     * Returns the current stack and sets a new one.
     */
    static getNext(): Progress | undefined {
        if (ClientProgress.nextProgress) {
            const old = ClientProgress.nextProgress;
            ClientProgress.nextProgress = undefined;
            return old;
        }
        return undefined;
    }

    /**
     * Sets up a new Progress object for the next API request to be made.
     * Only the very next API call will be tracked.
     *
     * @example
     * ```typescript
     *
     * ClientProgress.track();
     * await api.myMethod();
     *
     * ```
     */
    static track(): Progress {
        const progress = new Progress;
        ClientProgress.nextProgress = progress;
        return progress;
    }
}
