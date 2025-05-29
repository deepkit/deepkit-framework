import { assertType, ReceiveType, ReflectionKind, resolveReceiveType, stringifyType, Type } from '@deepkit/type';
import { EventToken } from '@deepkit/event';
import { parseTime } from './utils.js';
import { BrokerAdapterCache } from './broker-cache.js';
import { QueueMessageProcessing } from './model.js';
import { BrokerAdapterKeyValue } from './broker-key-value.js';
import { Logger } from '@deepkit/logger';
import { Subject, Subscription } from 'rxjs';
import { arrayRemoveItem, ensureError, formatError } from '@deepkit/core';
import { provide, Provider } from '@deepkit/injector';

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

    logger?: Logger;
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
    ) {
    }

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

export class BrokerBusSubject<T> extends Subject<T> {
    private refCount = 0;

    constructor(
        public handle: BrokerBusSubjectHandle,
        protected onFirst: () => void,
        protected onLast: () => void,
        protected onPublish: (value: T) => void,
    ) {
        super();
    }

    // @ts-ignore
    override subscribe(...args: Parameters<Subject<T>['subscribe']>): Subscription {
        const sub = super.subscribe(...args);

        if (this.refCount++ === 0) {
            this.onFirst();
        }

        sub.add(() => {
            if (--this.refCount === 0) {
                this.onLast();
            }
        });
        return sub;
    }

    override next(value: T, publish = true): void {
        if (publish) {
            this.onPublish(value);
        } else {
            super.next(value);
        }
    }
}

const subjectFinalizer = new FinalizationRegistry<{
    handle: BrokerBusSubjectHandle;
    subjectRef: WeakRef<BrokerBusSubject<unknown>>;
}>((handle) => {
    handle.handle.releaseSubject(handle.subjectRef);
});

class BrokerBusSubjectHandle {
    protected subjects: WeakRef<BrokerBusSubject<unknown>>[] = [];
    protected releaseChannel?: Promise<Release | void>;
    protected buffer: unknown[] = [];

    constructor(
        private channel: BrokerBusChannel<unknown>,
        private errorHandler: BusBrokerErrorHandler,
        private release: () => void,
    ) {
    }

    get isSubscribed(): boolean {
        return this.releaseChannel !== undefined;
    }

    /**
     * Ensures the broker channel is actively subscribed and starts buffering messages.
     * The messages will be replayed to the first subject subscriber.
     *
     * This method is useful when you need to make sure all events
     * from this point forward are not lost, e.g. to synchronize
     * a local state with broker data.
     *
     * @throws Error when the channel could not be subscribed to.
     */
    async ensureSubscribed(): Promise<void> {
        if (this.releaseChannel) return;

        const promise = this.releaseChannel = this.channel.subscribe(value => {
            if (this.subjects.length === 0) {
                this.buffer.push(value);
                return;
            }
            for (const subjectRef of this.subjects) {
                const subject = subjectRef.deref();
                if (subject) subject.next(value, false);
            }
        });
        await promise;
    }

    /**
     * Creates a new RefCountedSubject bound to this handle.
     * The subject starts broker subscription on first observer,
     * and automatically cleans up when no observers remain.
     *
     * Messages received before the first observer will be buffered
     * and replayed.
     *
     * @example
     * ```typescript
     * const subject = handle.createSubject();
     * subject.subscribe(value => console.log(value));
     * subject.next("msg");
     * ```
     */
    createSubject(): BrokerBusSubject<unknown> {
        let subjectRef: WeakRef<BrokerBusSubject<unknown>> | undefined = undefined;
        const subject = new BrokerBusSubject<unknown>(
            this,
            () => {
                this.subjects.push(subjectRef!);

                if (this.buffer.length) {
                    for (const value of this.buffer) {
                        subject.next(value, false);
                    }
                    this.buffer = [];
                }

                // Implicit subscribing must not throw
                this.ensureSubscribed().catch((e) => {
                    this.errorHandler.subscribeFailed(this.channel.name, ensureError(e));
                });
            },
            () => {
                this.releaseSubject(subjectRef!);
            },
            (value) => {
                this.publish(value);
            },
        );
        subjectRef = new WeakRef(subject);
        subjectFinalizer.register(subject, {
            handle: this,
            subjectRef,
        });
        return subject;
    }

    releaseSubject(subject: WeakRef<BrokerBusSubject<unknown>>) {
        arrayRemoveItem(this.subjects, subject);
        if (this.subjects.length === 0) {
            this.releaseChannel?.then(release => {
                release?.();
                this.releaseChannel = undefined;
            });
            this.release();
        }
    }

    publish(message: unknown) {
        this.channel.publish(message).catch((e) => {
            this.errorHandler.publishFailed(this.channel.name, message, this.channel.type, ensureError(e));
        });
    }
}

export class BusBrokerErrorHandler {
    constructor(protected logger?: Logger) {
    }

    publishFailed(path: string, message: unknown, type: Type, error: Error) {
        this.logger?.error(`Error while publishing message to channel ${path}: ${formatError(error)}`);
    }

    subscribeFailed(path: string, error: Error) {
        this.logger?.error(`Error while subscribing to channel ${path}: ${formatError(error)}`);
    }
}

export class BrokerBus {
    protected subjectHandles = new Map<string, BrokerBusSubjectHandle>();
    protected errorHandler: BusBrokerErrorHandler;

    constructor(
        public adapter: BrokerAdapterBus,
        errorHandler?: BusBrokerErrorHandler,
    ) {
        this.errorHandler = errorHandler ?? new BusBrokerErrorHandler(adapter.logger);
    }

    /**
     * Creates a broker channel handle for a given path and type.
     *
     * @param path Unique identifier of the broker channel.
     * @param type Optional message type for type-safe handling.
     */
    channel<T>(path: string, type?: ReceiveType<T>): BrokerBusChannel<T> {
        type = resolveReceiveType(type);
        return new BrokerBusChannel(path, this.adapter, type);
    }

    /**
     * Creates a Subject for the given broker channel.
     * Subscription to the broker is delayed until the first observer subscribes.
     *
     * Calling `.next()` publishes a message to the broker and does not forward
     * it to its observers immediately. Only messages from the broker are forwarded to observers.
     * This is to ensure consistent behaviour with other broker subjects from the same path.
     *
     * @param path Unique broker path.
     * @param type Optional type for strongly typed messages.
     *
     * @example
     * ```typescript
     * const subject = bus.subject<string>('updates');
     * subject.subscribe(console.log);
     * subject.next('hello');
     * ```
     */
    subject<T>(path: string, type?: ReceiveType<T>): Subject<T> {
        let handle = this.subjectHandles.get(path);
        if (!handle) {
            const resolvedType = resolveReceiveType(type);
            handle = new BrokerBusSubjectHandle(this.channel(path, resolvedType), this.errorHandler, () => {
                this.subjectHandles.delete(path);
            });
            this.subjectHandles.set(path, handle);
        }
        return handle.createSubject() as Subject<T>;
    }

    /**
     * Ensures the provided Subject is actively subscribed to the broker.
     * This guarantees that all messages from this point forward will be buffered,
     * and replayed to the first observer to avoid data loss.
     *
     * The subject unsubscribes from the broker automatically when all observers
     * are gone. To make it active, you need to subscribe to it first or call `activateSubject`.
     *
     * @throws Error when the channel could not be subscribed to.
     *
     * @example
     * ```typescript
     * const subject = bus.subject<string>('updates');
     * await bus.activateSubject(subject);
     * subject.subscribe(value => {
     *    // receives all messages from the time of activation
     * });
     * ```
     */
    async activateSubject<T extends Subject<any>>(subject: T): Promise<T> {
        if (subject instanceof BrokerBusSubject) {
            await subject.handle.ensureSubscribed();
        }
        return subject;
    }
}

/**
 * Provides a bus channel for the given path for @deepkit/injector modules.
 *
 * @see BrokerBusChannel
 */
export function provideBusChannel<T extends BrokerBusChannel<any>>(path: string, type?: ReceiveType<T>): Provider {
    type = resolveReceiveType(type);
    assertType(type, ReflectionKind.class);
    const messageType = type.arguments?.[0];
    if (!messageType) {
        throw new Error(`Type ${stringifyType(type)} does not have a message type defined`);
    }
    return provide((bus: BrokerBus) => bus.channel(path, messageType), type);
}

/**
 * Provides a bus Subject for the given channel path for @deepkit/injector modules.
 * This returns a transient provider, meaning that each time you inject it, a new subject is created.
 * The Subject automatically subscribes to the broker channel and unsubscribes when all subjects are garbage collected.
 *
 * @see BrokerBus.subject
 */
export function provideBusSubject<T extends Subject<any>>(path: string, type?: ReceiveType<T>): Provider {
    type = resolveReceiveType(type);
    assertType(type, ReflectionKind.class);
    const messageType = type.typeArguments?.[0];
    if (!messageType) {
        throw new Error(`Type ${stringifyType(type)} does not have a message type defined`);
    }
    return { provide: resolveReceiveType(type), useFactory: (bus: BrokerBus) => bus.subject(path, messageType), transient: true };
}

export class BrokerBusChannel<T> {
    constructor(
        public name: string,
        protected adapter: BrokerAdapterBus,
        public type: Type,
    ) {
    }

    async publish(message: T) {
        return await this.adapter.publish(this.name, message, this.type);
    }

    async subscribe(callback: (message: T) => void): Promise<Release> {
        return await this.adapter.subscribe(this.name, callback, this.type);
    }
}

export class BrokerLockError extends Error {

}

export class BrokerLock {
    constructor(
        public adapter: BrokerAdapterLock,
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

    async [Symbol.asyncDispose]() {
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
