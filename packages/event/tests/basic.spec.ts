import { test } from '@jest/globals';
import { EventDispatcher, EventToken } from '../src/event.js';

test('functional api', async () => {
    const dispatcher = new EventDispatcher();

    const MyEvent = new EventToken('my-event');

    dispatcher.listen(MyEvent, (event) => {
        console.log('MyEvent triggered!');
    });

    await dispatcher.dispatch(MyEvent);
});
