import 'jest';
import 'jest-extended';
import 'reflect-metadata';
import {MessageSubject} from "../src/client";

test('test MessageSubject', () => {
    let closeCalled = false;

    const subject = new MessageSubject(0);
    subject.subscribe().add(() => {
        closeCalled = true;
    });

    subject.complete();
    expect(closeCalled).toBeTrue();
});

test('test MessageSubject first', async () => {
    let closeCalled = false;

    const subject = new MessageSubject(0);
    subject.subscribe().add(() => {
        closeCalled = true;
    });

    setTimeout(() => {
        subject.next('peter');
    });

    const res = await subject.firstThenClose();
    expect(res).toBe('peter');
    expect(closeCalled).toBeTrue();
});
