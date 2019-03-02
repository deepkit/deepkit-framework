import 'jest';
import {BehaviorSubject, Subject} from "rxjs";
import {nextValue} from "../src/rxjs";

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
