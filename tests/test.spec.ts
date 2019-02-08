import 'jest';
import {Action, Controller} from "@kamille/server";
import {createServerClientPair} from "./util";
import {Observable} from "rxjs";
import {bufferCount, take} from "rxjs/operators";

test('test basic setup', async () => {
    @Controller('test')
    class TestController {
        @Action()
        names(last: string): string[] {
            return ['a', 'b', 'c', last];
        }
    }

    const {server, client, close} = await createServerClientPair([TestController]);
    const test = client.controller<TestController>('test');

    const names = await test.names('d');
    expect(names).toEqual(['a', 'b', 'c', 'd']);

    close();
});

test('test observable', async () => {
    @Controller('test')
    class TestController {
        @Action()
        observer(): Observable<string> {
            return new Observable((observer) => {
                observer.next('a');

                setTimeout(() => {
                    observer.next('b');
                }, 100);

                setTimeout(() => {
                    observer.next('c');
                }, 200);

                setTimeout(() => {
                    observer.complete();
                }, 300);
            });
        }
    }

    const {server, client, close} = await createServerClientPair([TestController]);
    const test = client.controller<TestController>('test');

    const observer = await test.observer();
    console.log('observer', observer);
    expect(observer).toBeInstanceOf(Observable);

    observer.pipe(bufferCount(3)).subscribe((next) => {
        expect(next).toEqual(['a', 'b', 'c']);
    });

    close();
});
