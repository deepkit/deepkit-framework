import { expect, test } from '@jest/globals';
import { BaseEvent, DataEvent, DataEventToken, EventDispatcher, EventError, EventOfEventToken, EventToken, EventTokenSync } from '../src/event.js';
import { sleep } from '@deepkit/core';

type TypeA = 'asd' | void;
function a(a: string, b: TypeA, c?: string) {}

a('asd');

test('functional api', async () => {
    const dispatcher = new EventDispatcher();
    type a = EventOfEventToken<EventToken>;

    const MyEvent = new EventToken('my-event');
    let calls = 0;

    dispatcher.listen(MyEvent, (event) => {
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

    dispatcher.listen(MyEvent, (event) => {
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
        user: User = new User;
    }

    const MyEventToken = new EventToken<MyEvent>('my-event');
    let calls = 0;

    dispatcher.listen(MyEventToken, (event) => {
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

    expect(() => dispatcher.listen(MyEvent, (event) => undefined)).toThrow(EventError);
});

test('fork', async () => {
    const dispatcher = new EventDispatcher();
    const MyEvent = new EventToken('my-event');
    let callsA = 0;

    const sub1 = dispatcher.listen(MyEvent, (event) => {
        callsA++;
    });

    await dispatcher.dispatch(MyEvent);
    expect(callsA).toBe(1);

    const fork = dispatcher.fork();
    let callsB = 0;
    const sub2 = fork.listen(MyEvent, (event) => {
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

test('sync not doing async stuff', async () => {
    const dispatcher = new EventDispatcher();
    const MyEvent = new EventTokenSync<DataEvent<{data: string}>>('my-event');
    let calls = 0;

    dispatcher.listen(MyEvent, (async () => {
        await sleep(0.01);
        calls++;
    }) as any);

    const res = dispatcher.dispatch(MyEvent, {data: 'abc'});
    expect(res).toBe(undefined);
    expect(calls).toBe(0);
    await sleep(0.1);
    expect(calls).toBe(1);
});


test('sync', async () => {
    const dispatcher = new EventDispatcher();
    const MyEvent = new EventTokenSync<DataEvent<{data: string}>>('my-event');
    let calls = 0;

    dispatcher.listen(MyEvent, () => {
        calls++;
    });

    const res = dispatcher.dispatch(MyEvent, new DataEvent({data: 'abc'}));
    expect(res).toBe(undefined);
    expect(calls).toBe(1);
});

test('custom event', async () => {
    const dispatcher = new EventDispatcher();
    class MyEvent extends BaseEvent {
        data: string = 'asd';
        type: string = '';
    }
    const myEventToken = new EventTokenSync<MyEvent>('my-event');
    let calls = 0;

    dispatcher.listen(myEventToken, () => {
        calls++;
    });

    // dispatcher.dispatch(myEventToken, undefined);
    // dispatcher.dispatch(myEventToken, new BaseEvent());

    const res = dispatcher.dispatch(myEventToken, new MyEvent());
    expect(res).toBe(undefined);
    expect(calls).toBe(1);
});

test('delayed event factory sync empty', async () => {
    const dispatcher = new EventDispatcher();
    const MyEvent = new EventTokenSync<DataEvent<{data: string}>>('my-event');
    let factories = 0;

    const res = dispatcher.dispatch(MyEvent, () => {
        factories++;
        return new DataEvent({data: 'abc'});
    });

    expect(res).toBe(undefined);
    expect(factories).toBe(0); // because no listener attached
});

test('delayed event factory sync filled', async () => {
    const dispatcher = new EventDispatcher();
    const myEvent = new EventTokenSync<DataEvent<{data: string}>>('my-event');
    let factories = 0;
    let calls = 0;

    dispatcher.listen(myEvent, () => {
        calls++;
    });

    const res = dispatcher.dispatch(myEvent, () => {
        factories++;
        return new DataEvent({data: 'abc'});
    });

    expect(res).toBe(undefined);
    expect(calls).toBe(1);
    expect(factories).toBe(1);
});

test('delayed event factory fork sync empty', async () => {
    const dispatcher = new EventDispatcher().fork()
    const MyEvent = new EventTokenSync<DataEvent<{data: string}>>('my-event');
    let factories = 0;

    const res = dispatcher.dispatch(MyEvent, () => {
        factories++;
        return new DataEvent({data: 'abc'});
    });

    expect(res).toBe(undefined);
    expect(factories).toBe(0); // because no listener attached
});

test('delayed event factory fork sync filled', async () => {
    const dispatcher = new EventDispatcher().fork();
    const myEvent = new EventTokenSync<DataEvent<{data: string}>>('my-event');
    let factories = 0;
    let calls = 0;

    dispatcher.listen(myEvent, () => {
        calls++;
    });

    const res = dispatcher.dispatch(myEvent, () => {
        factories++;
        return new DataEvent({data: 'abc'});
    });

    expect(res).toBe(undefined);
    expect(calls).toBe(1);
    expect(factories).toBe(1);
});
