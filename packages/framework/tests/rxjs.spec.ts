import { expect, test } from '@jest/globals';
import { BehaviorSubject } from 'rxjs';


test('rxjs complete on complete', () => {
    const subject = new BehaviorSubject<string[]>([]);

    let completed = false;
    subject.subscribe({
        complete: () => {
            completed = true;
        }
    });

    subject.complete();
    expect(completed).toBe(true);
});

test('rxjs no complete on unsubscribe', () => {
    const subject = new BehaviorSubject<string[]>([]);

    let completed = false;
    subject.subscribe().add(() => {
        completed = true;
    });

    subject.unsubscribe();
    expect(completed).toBe(false);
});
