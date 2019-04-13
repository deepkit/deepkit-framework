import 'jest';
import 'jest-extended';
import 'reflect-metadata';
import {MessageSubject} from "../src/socket";

test('test MessageSubject', () => {
    let closeCalled = false;

    const subject = new MessageSubject(() => {
        closeCalled = true;
    });

    subject.close();
    expect(closeCalled).toBeTrue();
});

test('test MessageSubject first', async () => {
    let closeCalled = false;

    const subject = new MessageSubject(() => {
        closeCalled = true;
    });

    setTimeout(() => {
        subject.next('peter');
    });

    const res = await subject.firstAndClose();
    expect(res).toBe('peter');
    expect(closeCalled).toBeTrue();
});
