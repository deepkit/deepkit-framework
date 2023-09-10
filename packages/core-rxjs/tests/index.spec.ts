import { expect, test } from '@jest/globals';
import { BehaviorSubject, Observable, ReplaySubject, Subject, Subscription } from 'rxjs';
import { decoupleSubject, isBehaviorSubject, isSubject, nextValue, Subscriptions, throttleMessages } from '../src/lib/utils.js';
import { ProgressTracker } from '../src/lib/progress.js';

test('nextValue subject', async () => {
    const subject = new Subject();

    setTimeout(() => {
        subject.next(5);
    }, 10);

    const next = await nextValue(subject);
    expect(next).toBe(5);
});

test('sub subject', async () => {
    const subject = new BehaviorSubject(2);

    const sub2 = new BehaviorSubject(1);
    const sub = subject.subscribe(sub2);
    sub2.subscribe().add(() => sub.unsubscribe());

    expect(sub2.getValue()).toBe(2);
    subject.next(3);
    expect(sub2.getValue()).toBe(3);

    sub2.complete();

    subject.next(4);
    expect(sub2.getValue()).toBe(3);
});

test('nextValue behaviorsubject', async () => {
    const subject = new BehaviorSubject(0);

    setTimeout(() => {
        subject.next(5);
    }, 10);

    const next = await nextValue(subject);
    expect(next).toBe(5);
});

test('is functions', async () => {
    expect(isSubject(new Observable)).toBe(false);
    expect(isSubject(new Subject)).toBe(true);
    expect(isSubject(new BehaviorSubject(undefined))).toBe(true);

    expect(isBehaviorSubject(new Observable)).toBe(false);
    expect(isBehaviorSubject(new Subject)).toBe(false);
    expect(isBehaviorSubject(new BehaviorSubject(undefined))).toBe(true);
});


test('Subscriptions unsubscribe', async () => {
    const subscriptions = new Subscriptions();

    const sub1 = subscriptions.add = new Subscription(() => {
    });
    const sub2 = subscriptions.add = new Subscription(() => {
    });

    expect(subscriptions.list.length).toBe(2);
    expect(sub1.closed).toBe(false);
    expect(sub2.closed).toBe(false);

    subscriptions.unsubscribe();

    expect(subscriptions.list.length).toBe(0);
    expect(sub1.closed).toBe(true);
    expect(sub2.closed).toBe(true);
});

test('Subscriptions auto remove', async () => {
    const subscriptions = new Subscriptions();

    const sub1 = subscriptions.add = new Subscription(() => {
    });
    const sub2 = subscriptions.add = new Subscription(() => {
    });

    expect(subscriptions.list.length).toBe(2);
    expect(sub1.closed).toBe(false);
    expect(sub2.closed).toBe(false);

    sub1.unsubscribe();

    expect(subscriptions.list.length).toBe(1);
    expect(sub1.closed).toBe(true);
    expect(sub2.closed).toBe(false);

    sub2.unsubscribe();

    expect(subscriptions.list.length).toBe(0);
    expect(sub1.closed).toBe(true);
    expect(sub2.closed).toBe(true);
});

test('throttleMessages', async () => {
    const behaviorSubject = new ReplaySubject<number>();
    for (let i = 0; i < 100; i++) {
        behaviorSubject.next(i);
    }

    setTimeout(() => {
        behaviorSubject.complete();
    }, 100);

    let i = 0;
    await throttleMessages(behaviorSubject, async (numbers) => {
        i++;
        if (i === 1) {
            expect(numbers.length).toBe(10);
        } else {
            //once the first batch is handled, the observable is filled completely up
            expect(numbers.length).toBe(90);
        }
    }, { batchSize: 10 });
});

test('progress', async () => {
    const progressTracker = new ProgressTracker();
    const test1 = progressTracker.track('test1', 5);
    test1.done++;
    test1.done++;

    expect(progressTracker.progress).toBe(2 / 5);
    expect(progressTracker.done).toBe(2);
    expect(progressTracker.total).toBe(5);
    expect(progressTracker.stopped).toBe(false);
    expect(progressTracker.finished).toBe(false);
    expect(progressTracker.ended).toBe(false);

    test1.done++;
    test1.done++;
    test1.done++;
    expect(progressTracker.progress).toBe(1);
    expect(progressTracker.done).toBe(5);
    expect(progressTracker.stopped).toBe(false);
    expect(progressTracker.finished).toBe(true);
    expect(progressTracker.ended).toBe(true);

    test1.done++;
    expect(progressTracker.progress).toBe(1);
    expect(progressTracker.done).toBe(5);
});

test('decouple observable', async () => {
    const subject = new ProgressTracker();
    const decoupled = decoupleSubject(subject);
    expect(subject === decoupled).toBe(false);
    expect(decoupled).toBeInstanceOf(BehaviorSubject);
    expect(subject.isStopped).toBe(false);
    expect(decoupled.isStopped).toBe(false);
    decoupled.complete();
    expect(subject.isStopped).toBe(false);
    expect(decoupled.isStopped).toBe(true);
});
