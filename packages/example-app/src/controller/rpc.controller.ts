import { rpc } from '@deepkit/rpc';
import { Observable, Subject } from 'rxjs';
import { t } from '@deepkit/type';

@rpc.controller('test-rpc')
export class RpcController {

    @rpc.action()
    @t.generic(Date)
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
    @t.generic(Date)
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
