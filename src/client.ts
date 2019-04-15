import {Subject, TeardownLogic} from "rxjs";
import {tearDown} from "@marcj/estdlib-rxjs";
import {first} from "rxjs/operators";

export class MessageSubject<T> extends Subject<T> {
    constructor(private teardown: TeardownLogic) {
        super();
    }

    /**
     * Used to unsubscribe from replies regarding this message and closing (completing) the subject.
     * Necessary to avoid memory leaks.
     */
    close() {
        tearDown(this.teardown);
        this.complete();
    }

    async firstAndClose(): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.pipe(first()).subscribe((next) => {
                resolve(next);
            }, (error) => {
                reject(error);
            }, () => {
                //complete
            }).add(() => {
                this.close();
            });
        });
    }
}

export type PromisifyFn<T extends ((...args: any[]) => any)> = (...args: Parameters<T>) => ReturnType<T> extends Promise<any> ? ReturnType<T>  : Promise<ReturnType<T> >;
export type RemoteController<T> = {
    [P in keyof T]: T[P] extends (...args: any[]) => any ? PromisifyFn<T[P]> : never
};
