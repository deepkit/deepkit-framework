import { Observable, Subject } from 'rxjs';
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
    setImmediate(async () => {
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

/**
 * Creates an Observable that resolves the given producer when subscribed to.
 * It also automatically disconnects the Observable when unsubscribed from.
 *
 * The producer can be a Promise or a function that returns a Promise.
 *
 * This function takes care of disconnecting the Observable when
 * unsubscribed from. This is the preferred way to handle Observables from RPC
 * actions since it cleans up resources on the server when done working with
 * the Observable.
 *
 * @see disconnectObservable
 *
 * ```typescript
 * const client = new RpcClient();
 * const controller = client.controller<MyController>('controller');
 *
 * // normally you would do this. Note that you are the owner of the Observable
 * // and you need to call unsubscribe() when you are done with it.
 * const observable = await controller.subscribeChats('asd');
 *
 * // but with instantObservable you can do this, allowing you to get
 * // an Observable in a synchronous way.
 * const observable = instantObservable(controller.subscribeChats('asd'));
 *
 * // or with a function, which is useful when you only want to do RPC calls
 * // when the Observable is actually subscribed to.
 * const observable = instantObservable(() => controller.subscribeChats('asd'));
 * ```
 */
export function instantObservable<T>(producer: InstanceProducer<Observable<T>>): Observable<T> {
    return new Observable<T>((observer) => {
        let active: Observable<T> | undefined;
        resolveProducer(producer).then((o) => {
            o.subscribe(observer);
            active = o;
        }, (error) => {
            observer.error(error);
        });
        return () => {
            if (active) disconnectObservable(active);
        }
    });
}

/**
 * Every Observable that was created from an RPC action needs to be disconnected
 * when done working with it. In normal RXJS environment the garbage collector
 * would take care of this, but in the RPC world we need to manually disconnect
 * the Observable to free up resources on the server.
 *
 * Note: The server has to keep the Observable alive as long as the client
 * is connected. This is required to be able to subscribe to the Observable
 * again. When the client disconnects, the server disconnects the Observable
 * automatically. But when the client is connected for a longer time, the client
 * should manually disconnect the Observable when done working with it.
 *
 * This means concretely that if you call an RPC action that returns an
 * Observable 100x, we need to keep 100 Observables alive on the server.
 * When the client disconnects, the server will automatically disconnect
 * all 100 Observables, but if the client stays connected, the server will
 * keep all 100 Observables alive. This is why it's important to disconnect
 * Observables when done working with them.
 *
 * An alternative way to make this more explicit is working with Subjects
 * instead of Observables. Whenever a Subject is created from an RPC action,
 * the client has to call subject.complete() when done working with it.
 * This has other drawbacks though, like the client can't resubscribe to
 * the Subject again, and the Subject starts emitting values immediately
 * when created without waiting for a subscription.
 */
export function disconnectObservable<T>(observable: Observable<T>): void {
    if ('disconnect' in observable && isFunction((observable as any).disconnect)) {
        (observable as any).disconnect();
    }
}
