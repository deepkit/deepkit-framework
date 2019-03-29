import 'jest';
import {FilterQuery, IdInterface, StreamBehaviorSubject} from "..";
import {ClassType} from '@marcj/estdlib';

function assert<T, U extends T>() {
}

test('test FilterQuery', async () => {
    interface File {
        path: string;
    }

    type d = FilterQuery<File>;
    assert<d, {path: 'sd'}>()
    ;
    type d2 = FilterQuery<IdInterface>;
    assert<d2, {id: 'sd'}>();

    function doIt<T extends IdInterface>(query: FilterQuery<T>) {
    }

    doIt({id: '333'});

    function get<T extends IdInterface>(
        classType: ClassType<T>,
        filter: FilterQuery<T>
    ) {}

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
