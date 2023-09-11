import { rpc } from '@deepkit/rpc';
import { Observable, Subject } from 'rxjs';

@rpc.controller('test-rpc')
export class RpcController {

    @rpc.action()
    timesSubject(): Subject<Date> {
        const subject = new Subject<Date>();

        const interval = setInterval(() => {
            subject.next(new Date);
        }, 1000);

        setTimeout(() => {
            subject.complete();
        }, 10_000);

        subject.subscribe().add(() => {
            clearTimeout(interval);
        });

        return subject;
    }

    @rpc.action()
    timesObservable(): Observable<Date> {
        return new Observable((observer) => {
            const interval = setInterval(() => {
                observer.next(new Date);
            }, 1000);

            setTimeout(() => {
                observer.complete();
                clearTimeout(interval);
            }, 10_000);

            return {
                unsubscribe() {
                    clearTimeout(interval);
                }
            };
        });
    }

}
