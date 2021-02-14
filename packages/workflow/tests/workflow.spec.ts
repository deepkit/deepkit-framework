import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { createWorkflow, WorkflowEvent } from '../src/workflow';
import { eventDispatcher, EventDispatcher, EventToken } from '@deepkit/event';
import { injectable, InjectorContext } from '@deepkit/injector';

class EndEvent extends WorkflowEvent {
    test: string = 'hi';
}

const workflow1 = createWorkflow('myFlow', {
    start: WorkflowEvent,
    doIt: WorkflowEvent,
    failed: WorkflowEvent,
    success: WorkflowEvent,
    end: EndEvent,
}, {
    start: 'doIt',
    doIt: ['failed', 'success'],
    success: 'end',
    failed: 'end'
});

test('workflow', async () => {
    expect(workflow1.onDoIt).toBeInstanceOf(EventToken);

    const w = workflow1.create('start', new EventDispatcher());
    expect(w.state.get()).toBe('start');
    expect(w.isDone()).toBe(false);

    expect(w.can('doIt')).toBe(true);
    expect(w.can('failed')).toBe(false);
    expect(w.can('success')).toBe(false);
    expect(w.can('end')).toBe(false);

    await expect(w.apply('success')).rejects.toThrow('Can not apply state change from start->success');

    await w.apply('doIt');
    expect(w.state.get()).toBe('doIt');
    expect(w.isDone()).toBe(false);

    expect(w.can('doIt')).toBe(false);
    expect(w.can('failed')).toBe(true);
    expect(w.can('success')).toBe(true);
    expect(w.can('end')).toBe(false);
    expect(w.isDone()).toBe(false);

    await w.apply('success');
    await expect(w.apply('end')).rejects.toThrow('State end got the wrong event. Expected EndEvent, got WorkflowEvent');
    await w.apply('end', new EndEvent());

    expect(w.isDone()).toBe(true);
    expect(w.state.get()).toBe('end');
});

test('workflow events', async () => {
    const dispatcher = new EventDispatcher(InjectorContext.forProviders([]));
    const w = workflow1.create('start', dispatcher);

    let called = false;
    dispatcher.registerCallback(workflow1.onDoIt, async () => {
        called = true;
    });

    await w.apply('doIt');

    expect(called).toBe(true);
    expect(w.state.get()).toBe('doIt');
});

test('workflow events listener', async () => {
    let called = false;

    class Listener {
        @eventDispatcher.listen(workflow1.onDoIt)
        onDoIt() {
            called = true;
        }
    }

    const dispatcher = new EventDispatcher(InjectorContext.forProviders([Listener]));
    const w = workflow1.create('start', dispatcher);

    dispatcher.registerListener(Listener);

    await w.apply('doIt');

    expect(called).toBe(true);
    expect(w.state.get()).toBe('doIt');
});

test('workflow events apply next', async () => {
    const dispatcher = new EventDispatcher(InjectorContext.forProviders([]));
    const w = workflow1.create('start', dispatcher);

    let endCalled = false;
    dispatcher.registerCallback(workflow1.onDoIt, async (event) => {
        event.next('success');
    });

    dispatcher.registerCallback(workflow1.onSuccess, async (event) => {
        event.next('end', new EndEvent());
    });

    dispatcher.registerCallback(workflow1.onEnd, async (event) => {
        expect(event.test).toBe('hi');
        endCalled = true;
    });

    await w.apply('doIt');

    expect(w.state.get()).toBe('end');
    expect(endCalled).toBe(true);
});

test('workflow events apply next invalid', async () => {
    const dispatcher = new EventDispatcher(InjectorContext.forProviders([]));
    const w = workflow1.create('start', dispatcher);

    dispatcher.registerCallback(workflow1.onDoIt, async (event) => {
        event.next('end');
    });

    await expect(w.apply('doIt')).rejects.toThrow('Can not apply state change from doIt->end');
});

test('workflow events apply injector', async () => {
    class MyService {
        data: string = 'myData';
    }

    @injectable()
    class Listener {
        constructor(private myService: MyService) {
        }

        @eventDispatcher.listen(workflow1.onDoIt)
        onDoIt() {
            expect(this.myService).toBeInstanceOf(MyService);
            this.myService.data = 'changedData';
        }
    }

    const context = InjectorContext.forProviders([
        MyService, Listener
    ]);
    const dispatcher = new EventDispatcher(context);
    const w = workflow1.create('start', dispatcher);

    dispatcher.registerListener(Listener);
    await w.apply('doIt');

    expect(context.get(MyService).data).toBe('changedData');
});
