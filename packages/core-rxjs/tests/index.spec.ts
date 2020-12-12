import {expect, test} from '@jest/globals';
import {BehaviorSubject, Subject, Subscription} from 'rxjs';
import {nextValue, Subscriptions} from '../src/rxjs';

test('nextValue subject', async () => {
    const subject = new Subject();

    setTimeout(() => {
       subject.next(5);
    }, 10);

    const next = await nextValue(subject);
    expect(next).toBe(5);
});

test('nextValue behaviorsubject', async () => {
    const subject = new BehaviorSubject(0);

    setTimeout(() => {
       subject.next(5);
    }, 10);

    const next = await nextValue(subject);
    expect(next).toBe(5);
});


test('Subscriptions unsubscribe', async () => {
    const subscriptions = new Subscriptions();

    const sub1 = subscriptions.add = new Subscription(() => {});
    const sub2 = subscriptions.add = new Subscription(() => {});

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

    const sub1 = subscriptions.add = new Subscription(() => {});
    const sub2 = subscriptions.add = new Subscription(() => {});

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
