import {expect, test} from '@jest/globals';
import 'reflect-metadata';
import {FilterQuery, IdInterface, StreamBehaviorSubject} from "../index";
import {ClassType, sleep} from '@deepkit/core';
import {BehaviorSubject, Subject} from 'rxjs';

function assert<T, U extends T>() {
}

test('test teardown', async () => {
    {
        let tearDownCalled = false;

        const subject = new Subject();
        subject.subscribe({error: () => {}}).add(() => {
            tearDownCalled = true;
        });

        subject.complete();
        expect(tearDownCalled).toBe(true);
        expect(subject.closed).toBe(false);

        subject.unsubscribe();
        expect(subject.closed).toBe(true);
    }

    {
        let tearDownCalled = false;

        const subject = new Subject();
        subject.subscribe({error: () => {}}).add(() => {
            tearDownCalled = true;
        });

        subject.error('asd');
        expect(subject.closed).toBe(false);
        expect(tearDownCalled).toBe(true);

        subject.unsubscribe();
        expect(subject.closed).toBe(true);

        await sleep(1);
    }
});

test('test decayed error', async () => {

    async function doIt() {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                reject('Ciao');
            }, 100);
        });
    }

    doIt().catch(() => {});
    await sleep(0.2);
});


test('test error subject', async () => {
    {
        let gotError: string | undefined;

        try {
            const subject = new Subject();

            subject.subscribe(() => {
            }, (error) => {
                gotError = error;
            });
            subject.subscribe({error: () => {}});

            subject.error('My Error');
            subject.unsubscribe();

            await sleep(1);
        } catch (error) {}
    }
});

test('test root/child', async () => {
    const root = new BehaviorSubject<string>('');
    const child2 = new BehaviorSubject<string>('');

    const sub2 = root.subscribe((next) => {
        console.log('nextd', next);
        try {
            child2.next(next);
        } catch (error) {
            sub2.unsubscribe();
            console.log('sub2 forward error', error);
        }
    }, (error) => {
        child2.error(error);
        console.log('sub2 error', error);
    }, () => {
        child2.complete();
        console.log('sub2 complete');
    });

    child2.unsubscribe();

    console.log('root next 1');
    root.next('asd 1');

    console.log('root next 2');
    root.next('asd 2');

    console.log('root next 3');
    root.next('asd 3');
});

test('test FilterQuery', async () => {
    interface File {
        path: string;
    }

    type d = FilterQuery<File>;
    assert<d, { path: 'sd' }>()
    ;
    type d2 = FilterQuery<IdInterface>;
    assert<d2, { id: 'sd' }>();

    function doIt<T extends IdInterface>(query: FilterQuery<T>) {
    }

    doIt({id: '333'});

    function get<T extends IdInterface>(
        classType: ClassType<T>,
        filter: FilterQuery<T>
    ) {
    }

    doIt({id: '123'});
    doIt({$or: [{id: '123'}, {id: '2333'}]});
    doIt({id: {$in: ['123', '2333']}});
});

test('test StreamBehaviorSubject', async () => {
    let teardownCalled = false;

    const subject = new StreamBehaviorSubject(undefined, () => {
        teardownCalled = true;
    });

    await subject.unsubscribe();

    expect(teardownCalled).toBe(true);
});

test('test StreamBehaviorSubject fork', async () => {
    let rootTeardownCalled = false;

    const subject = new StreamBehaviorSubject(undefined, () => {
        rootTeardownCalled = true;
    });

    let forkTeardownCalled = false;
    const fork = new StreamBehaviorSubject(undefined, () => {
        forkTeardownCalled = true;
    });
    subject.subscribe(fork);

    expect(rootTeardownCalled).toBe(false);
    expect(forkTeardownCalled).toBe(false);

    await fork.unsubscribe();
    expect(rootTeardownCalled).toBe(false);
    expect(forkTeardownCalled).toBe(true);

    await subject.unsubscribe();
    expect(rootTeardownCalled).toBe(true);
    expect(forkTeardownCalled).toBe(true);
});
