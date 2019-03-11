import 'jest';
import {StreamBehaviorSubject} from "..";

test('test StreamBehaviorSubject', async () => {

    let teardownCalled = false;

    const subject = new StreamBehaviorSubject(undefined, () => {
        teardownCalled = true;
    });

    subject.unsubscribe();

    expect(teardownCalled).toBe(true);
});
