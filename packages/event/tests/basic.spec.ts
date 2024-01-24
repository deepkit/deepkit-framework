import { expect, test } from '@jest/globals';

import { BaseEvent, DataEventToken, EventDispatcher, EventError, EventToken } from '../src/event.js';

test('functional api', async () => {
    const dispatcher = new EventDispatcher();

    const MyEvent = new EventToken('my-event');
    let calls = 0;

    dispatcher.listen(MyEvent, event => {
        calls++;
    });

    await dispatcher.dispatch(MyEvent);
    expect(calls).toBe(1);
    await dispatcher.dispatch(MyEvent);
    expect(calls).toBe(2);
});

test('data event', async () => {
    const dispatcher = new EventDispatcher();
    class User {}

    const MyEvent = new DataEventToken<User>('my-event');
    let calls = 0;

    dispatcher.listen(MyEvent, event => {
        expect(event.data).toBeInstanceOf(User);
        calls++;
    });

    await dispatcher.dispatch(MyEvent, new User());
    expect(calls).toBe(1);
});

test('custom event', async () => {
    const dispatcher = new EventDispatcher();
    class User {}

    class MyEvent extends BaseEvent {
        user: User = new User();
    }

    const MyEventToken = new EventToken<MyEvent>('my-event');
    let calls = 0;

    dispatcher.listen(MyEventToken, event => {
        expect(event).toBeInstanceOf(MyEvent);
        expect(event.user).toBeInstanceOf(User);
        calls++;
    });

    await dispatcher.dispatch(MyEventToken, new MyEvent());
    expect(calls).toBe(1);
});

test('throw when already built', async () => {
    const dispatcher = new EventDispatcher();
    const MyEvent = new EventToken('my-event');

    await dispatcher.dispatch(MyEvent);

    expect(() => dispatcher.listen(MyEvent, event => undefined)).toThrow(EventError);
});

test('fork', async () => {
    const dispatcher = new EventDispatcher();
    const MyEvent = new EventToken('my-event');
    let callsA = 0;

    const sub1 = dispatcher.listen(MyEvent, event => {
        callsA++;
    });

    await dispatcher.dispatch(MyEvent);
    expect(callsA).toBe(1);

    const fork = dispatcher.fork();
    let callsB = 0;
    const sub2 = fork.listen(MyEvent, event => {
        callsB++;
    });

    await fork.dispatch(MyEvent);
    expect(callsA).toBe(2);
    expect(callsB).toBe(1);

    sub2();
    await fork.dispatch(MyEvent);
    expect(callsA).toBe(3);
    expect(callsB).toBe(1);

    expect(() => sub1()).toThrow(EventError);
});
