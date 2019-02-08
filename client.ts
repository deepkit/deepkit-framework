import {Collection, IdInterface} from "@kamille/core";
import {Observable} from "rxjs";
import {SocketClient} from "./src/socket";
import {Entity, NumberType, StringType, uuid} from "@marcj/marshal";

@Entity('user')
class User implements IdInterface {
    @StringType()
    id: string = uuid();

    @NumberType()
    version: number = 1;

    @StringType()
    name: string;

    constructor(name: string) {
        this.name = name;
    }
}

interface UserInterface {
    name(): string;

    users(): Observable<User>;

    bla(): Observable<string>;

    userList(): Collection<User>;
}

(async () => {
    const socket = new SocketClient();

    const user = socket.controller<UserInterface>('user');
    // const name = await user.name();
    //
    // console.log('result is:', name);
    //
    // const subscription = (await user.bla()).subscribe((next) => {
    //     console.log('next', next);
    // }, (error: any) => {
    //     console.error('error', error);
    // }, () => {
    //     console.log('complete');
    // });
    //
    // setTimeout(() => {
    //     subscription.unsubscribe();
    // }, 5000);
    //
    // const users = await user.users();
    // users.subscribe((next) => {
    //     console.log('users next', next);
    // }, (error) => {
    //     console.log('users error', error);
    // }, () => {
    //     console.log('users complete');
    // })

    const users = await user.userList();
    users.subscribe((next) => {
        console.log('users next', next);
    }, (error) => {
        console.log('users error', error);
    }, () => {
        console.log('users complete');
    });

    // await users.ready.toPromise();
    // console.log('users', users.all());

    // users.subscribe(() => {
    //     console.log('users update', users.all());
    // });

    // socket.disconnect();
})();
