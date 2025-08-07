import { Subject } from 'rxjs';
import { isFunction } from '@deepkit/core';

/**
 * Create a Subject with teardown function that is called when
 * client disconnects or completes the subject.
 *
 * The producer is called in the next tick, no matter if the client
 * subscribes to the subject or not. This is fundamentally different
 * from Observables, where the producer is only called when the Observable
 * is subscribed to.
 *
 * Teardown is also called when the producer errors or completes.
 *
 * You should normally prefer using Observables (with instantObservable)
 * over Subjects, as Subjects are not lazy and start emitting values
 * immediately when created.
 *
 * ```typescript
 * class Controller {
 *   @rpc.action()
 *   subscribeChats(channel: string): Subject<Message> {
 *     return createSubject((subject) => {
 *        subject.next({ text: 'hello' });
 *        subject.next({ text: 'world' });
 *        subject.complete();
 *     }, () => {
 *        // cleanup
 *     });
 *   }
 * }
 * ```
 */
export function createSubject<T>(
    producer: (subject: Subject<T>) => void | Promise<void>,
    teardown?: () => void,
): Subject<T> {
    const subject = new Subject<T>();
    queueMicrotask(async () => {
        try {
            await producer(subject);
        } catch (error) {
            subject.error(error);
        }
    });
    if (teardown) subject.subscribe().add(teardown);
    return subject;
}

export type InstanceProducer<T> = T | Promise<T> | (() => T) | (() => Promise<T>);

async function resolveProducer<T>(producer: InstanceProducer<T>): Promise<T> {
    if (producer instanceof Promise) {
        return producer;
    }
    if (isFunction(producer)) {
        return producer();
    }
    return producer;
}

/**
 * Returns a Subject that is immediately subscribed to the given producer.
 *
 * The producer can be a Promise or a function that returns a Promise.
 *
 * Note that the Subject will be requested from the Promise right away.
 *
 * ```typescript
 * const client = new RpcClient();
 * const controller = client.controller<MyController>('controller');
 *
 * // normally you would do this:
 * const subject = await controller.subscribeChats('asd');
 *
 * // but with instantSubject you can do this, allowing you to get
 * // a Subject in a synchronous way.
 * const subject = instantSubject(controller.subscribeChats('asd'));
 * ```
 */
export function instantSubject<T>(producer: InstanceProducer<Subject<T>>): Subject<T> {
    const subject = new Subject<T>();
    resolveProducer(producer).then((s) => {
        s.subscribe(subject);
        subject.subscribe().add(() => s.complete());
    }, (error) => {
        subject.error(error);
    });
    return subject;
}
