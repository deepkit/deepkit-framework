import {Subject} from "rxjs";
import {first} from "rxjs/operators";
import {ClientMessageWithoutId, ServerMessageComplete, ServerMessageError} from "./contract";

export class MessageSubject<T> extends Subject<T> {
    public readonly disconnected = new Subject<number>();
    public readonly reconnected = new Subject<void>();

    constructor(
        public readonly connectionId: number,
        private onReply?: (message: ClientMessageWithoutId) => MessageSubject<any>,
    ) {
        super();
    }

    /**
     * Sends a message to the server and returns a new MessageSubject.
     * If the connection meanwhile has been reconnected, and completed MessageSubject.
     */
    public sendMessage<T = { type: '' }, K = T | ServerMessageComplete | ServerMessageError>(
        messageWithoutId: ClientMessageWithoutId
    ): MessageSubject<K> {
        if (!this.onReply) {
            throw new Error('No replier set');
        }

        return this.onReply(messageWithoutId);
    }

    error(err: any): void {
        this.disconnected.complete();
        super.error(err);
    }

    complete(): void {
        this.disconnected.complete();
        super.complete();
    }

    async firstOrUndefinedThenClose(): Promise<T | undefined> {
        return new Promise<T>((resolve) => {
            this.pipe(first()).subscribe((next) => {
                resolve(next);
            }, (error) => {
                resolve();
            }, () => {
                //complete
            }).add(() => {
                this.complete();
            });
        });
    }

    async firstThenClose(): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.pipe(first()).subscribe((next) => {
                resolve(next);
            }, (error) => {
                reject(error);
            }, () => {
                //complete
            }).add(() => {
                this.complete();
            });
        });
    }
}

export type PromisifyFn<T extends ((...args: any[]) => any)> = (...args: Parameters<T>) => ReturnType<T> extends Promise<any> ? ReturnType<T>  : Promise<ReturnType<T> >;
export type RemoteController<T> = {
    [P in keyof T]: T[P] extends (...args: any[]) => any ? PromisifyFn<T[P]> : never
};
