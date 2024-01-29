import { ReceiveType, resolveReceiveType, Type } from '@deepkit/type';
import { EventToken } from '@deepkit/event';
import { parseTime } from './utils.js';
import { BrokerAdapterCache } from './broker-cache.js';
import { QueueMessageProcessing } from './model.js';

export interface BrokerTimeOptions {
    /**
     * Time to live in milliseconds. 0 means no ttl.
     * Value is either milliseconds or a string like '2 minutes', '8s', '24hours'.
     */
    ttl: string | number;

    /**
     * Timeout in milliseconds. 0 means no timeout.
     * Value is either milliseconds or a string like '2 minutes', '8s', '24hours'.
     */
    timeout: number | string;
}

export interface BrokerTimeOptionsResolved {
    /**
     * Time to live in milliseconds. 0 means no ttl.
     */
    ttl: number;

    /**
     * Timeout in milliseconds. 0 means no timeout.
     */
    timeout: number;
}

export type BrokerQueueMessageProcessingOptions = {
    process: QueueMessageProcessing.atLeastOnce
} | {
    process: QueueMessageProcessing.exactlyOnce;
    deduplicationInterval?: string,
    hash?: string | number;
};

export interface BrokerQueueMessageProcessingOptionsResolved {
    process: QueueMessageProcessing;
    deduplicationInterval: number;
    hash?: string | number;
}

export type BrokerAdapterQueueProduceOptions = { delay?: string; priority?: number } & BrokerQueueMessageProcessingOptions;

export interface BrokerAdapterQueueProduceOptionsResolved extends BrokerQueueMessageProcessingOptionsResolved {
    delay?: number;
    priority?: number;
}

function parseBrokerQueueMessageProcessingOptions(options?: BrokerQueueMessageProcessingOptions): BrokerQueueMessageProcessingOptionsResolved {
    switch (options?.process) {
        case QueueMessageProcessing.exactlyOnce:
            return {
                process: QueueMessageProcessing.exactlyOnce,
                deduplicationInterval: parseTime(options.deduplicationInterval || '5m')!,
                hash: options.hash,
            };

        case QueueMessageProcessing.atLeastOnce:
        default:
            return {
                process: QueueMessageProcessing.atLeastOnce,
                deduplicationInterval: 0,
            };
    }
}

function parseBrokerQueueChannelProduceOptions(options?: BrokerAdapterQueueProduceOptions, channelOptions?: BrokerQueueChannelOptionsResolved): BrokerAdapterQueueProduceOptionsResolved {
    const processingOptions = parseBrokerQueueMessageProcessingOptions(options);
    if (options?.process == null && channelOptions?.process != null) {
        processingOptions.process = channelOptions.process;
    }
    if (options?.process == null && processingOptions.process === QueueMessageProcessing.exactlyOnce && channelOptions?.process === QueueMessageProcessing.exactlyOnce) {
        processingOptions.deduplicationInterval = channelOptions.deduplicationInterval;
    }

    return {
        delay: parseTime(options?.delay),
        priority: options?.priority,
        ...processingOptions,
    };
}

function parseBrokerQueueChannelOptions(options?: BrokerQueueChannelOptions): BrokerQueueChannelOptionsResolved {
    return parseBrokerQueueMessageProcessingOptions(options);
}

function parseBrokerTimeoutOptions(options: Partial<BrokerTimeOptions>): BrokerTimeOptionsResolved {
    return {
        ttl: parseTime(options.ttl) ?? 0,
        timeout: parseTime(options.timeout) ?? 0,
    };
}


export type Release = () => Promise<void>;

export interface BrokerInvalidateCacheMessage {
    key: string;
    ttl: number;
}

export interface BrokerAdapterBase {
    disconnect(): Promise<void>;
}

export interface BrokerAdapterLock extends BrokerAdapterBase {
    lock(id: string, options: BrokerTimeOptionsResolved): Promise<undefined | Release>;

    isLocked(id: string): Promise<boolean>;

    tryLock(id: string, options: BrokerTimeOptionsResolved): Promise<undefined | Release>;
}

export interface BrokerAdapterBus extends BrokerAdapterBase {
    /**
     * Publish a message on the bus aka pub/sub.
     */
    publish(name: string, message: any, type: Type): Promise<void>;

    /**
     * Subscribe to messages on the bus aka pub/sub.
     */
    subscribe(name: string, callback: (message: any) => void, type: Type): Promise<Release>;
}

export interface BrokerAdapterQueue extends BrokerAdapterBase {
    /**
     * Consume messages from a queue.
     */
    consume(name: string, callback: (message: any) => Promise<void>, options: { maxParallel: number }, type: Type): Promise<Release>;

    /**
     * Produce a message to a queue.
     */
    produce(name: string, message: any, type: Type, options?: BrokerAdapterQueueProduceOptionsResolved): Promise<void>;
}

export interface BrokerAdapterKeyValue extends BrokerAdapterBase {
    get(key: string, type: Type): Promise<any>;

    set(key: string, value: any, type: Type): Promise<any>;

    increment(key: string, value: any): Promise<number>;
}

export const onBrokerLock = new EventToken('broker.lock');

export class BrokerQueueMessage<T> {
    public state: 'pending' | 'done' | 'failed' = 'pending';
    public error?: Error;

    public tries: number = 0;
    public delayed: number = 0;

    constructor(
        public channel: string,
        public data: T,
    ) {
    }

    public failed(error: Error) {
        this.state = 'failed';
        this.error = error;
    }

    public delay(seconds: number) {
        this.delayed = seconds;
    }
}

export type BrokerQueueChannelOptions = BrokerQueueMessageProcessingOptions;

export type BrokerQueueChannelOptionsResolved = BrokerQueueMessageProcessingOptionsResolved;


export class BrokerQueue {
    constructor(
        public adapter: BrokerAdapterQueue,
    ) {}

    public channel<T>(name: string, options?: BrokerQueueChannelOptions, type?: ReceiveType<T>): BrokerQueueChannel<T> {
        type = resolveReceiveType(type);
        return new BrokerQueueChannel(name, this.adapter, options, type);
    }
}

export class BrokerQueueChannel<T> {
    private options: BrokerQueueChannelOptionsResolved;

    constructor(
        public name: string,
        private adapter: BrokerAdapterQueue,
        options: BrokerQueueChannelOptions | undefined,
        private type: Type,
    ) {
        this.options = parseBrokerQueueChannelOptions(options);
    }

    async produce<T>(message: T, options?: BrokerAdapterQueueProduceOptions): Promise<void> {
        await this.adapter.produce(this.name, message, this.type, parseBrokerQueueChannelProduceOptions(options, this.options));
    }

    async consume(callback: (message: BrokerQueueMessage<T>) => Promise<void> | void, options: { maxParallel?: number } = {}): Promise<Release> {
        return await this.adapter.consume(this.name, async (message) => {
            try {
                await callback(message);
            } catch (error: any) {
                message.state = 'failed';
                message.error = error;
            }
        }, Object.assign({ maxParallel: 1 }, options), this.type);
    }
}

export class BrokerBus {
    constructor(public adapter: BrokerAdapterBus) {
    }

    public channel<T>(path: string, type?: ReceiveType<T>): BrokerBusChannel<T> {
        type = resolveReceiveType(type);
        return new BrokerBusChannel(path, this.adapter, type);
    }
}

export class BrokerBusChannel<T> {
    constructor(
        public name: string,
        private adapter: BrokerAdapterBus,
        private type: Type,
    ) {
    }

    async publish(message: T) {
        return this.adapter.publish(this.name, message, this.type);
    }

    async subscribe(callback: (message: T) => void): Promise<Release> {
        return this.adapter.subscribe(this.name, callback, this.type);
    }
}

export class BrokerLockError extends Error {

}

export class BrokerLock {
    constructor(
        public adapter: BrokerAdapterLock
    ) {
    }

    public item(id: string, options: Partial<BrokerTimeOptions> = {}): BrokerLockItem {
        const parsedOptions = parseBrokerTimeoutOptions(options);
        parsedOptions.ttl ||= 60 * 2 * 1000; //2 minutes
        parsedOptions.timeout ||= 30 * 1000; //30 seconds
        return new BrokerLockItem(id, this.adapter, parsedOptions);
    }
}

export class BrokerLockItem {
    protected releaser?: Release;

    constructor(
        private id: string,
        private adapter: BrokerAdapterLock,
        private options: BrokerTimeOptionsResolved,
    ) {
    }

    async [Symbol.asyncDispose] () {
        await this.release();
    }

    /**
     * Disposable way of acquiring a lock. Automatically releases the lock when the returned object is disposed.
     *
     * @example
     * ```typescript
     * async function doSomething() {
     *   async using hold = lock.hold();
     *
     *   // do stuff
     *
     *   // when out of scope, lock is automatically released.
     * }
     * ```
     */
    async hold() {
        await this.acquire();
        return this;
    }

    /**
     * Returns true if the current lock object is the holder of the lock.
     *
     * This does not check whether the lock is acquired by someone else.
     * Use isReserved() if you want to check that.
     */
    get acquired(): boolean {
        return this.releaser !== undefined;
    }

    /**
     * Acquires the lock. If the lock is already acquired by someone else, this method waits until the lock is released.
     *
     * @throws BrokerLockError when lock is already acquired by this object.
     */
    async acquire(): Promise<this> {
        if (this.releaser) throw new BrokerLockError(`Lock already acquired. Call release first.`);
        this.releaser = await this.adapter.lock(this.id, this.options);
        return this;
    }

    /**
     * Checks if the lock is acquired by someone else.
     */
    async isReserved(): Promise<boolean> {
        return await this.adapter.isLocked(this.id);
    }

    /**
     * Tries to acquire the lock.
     * If the lock is already acquired, nothing happens.
     *
     * @throws BrokerLockError when lock is already acquired by this object.
     */
    async try(): Promise<this | undefined> {
        if (this.releaser) throw new BrokerLockError(`Lock already acquired. Call release first.`);
        this.releaser = await this.adapter.tryLock(this.id, this.options);
        return this.releaser ? this : undefined;
    }

    /**
     * Releases the lock.
     */
    async release(): Promise<void> {
        if (!this.releaser) return;
        await this.releaser();
        this.releaser = undefined;
    }
}

export type BrokerAdapter = BrokerAdapterCache & BrokerAdapterBus & BrokerAdapterLock & BrokerAdapterQueue & BrokerAdapterKeyValue;
