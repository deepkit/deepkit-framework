import {Collection, IdInterface} from "@kamille/core";
import {Observable} from "rxjs";
import {SocketClient} from "./src/socket";
import {Entity} from "@marcj/marshal";

@Entity('user')
class User implements IdInterface {
    id!: string;
    version!: number;
    name!: string;
}

interface UserInterface {
    name(): string;

    // where do we get the User ClassType?
    //we send with FindResult entityName and add to marshal a entity register
    users(): Collection<User>;

    bla(): Observable<string>;
}

(async () => {
    const socket = new SocketClient();

    const user = socket.controller<UserInterface>('user');
    const name = await user.name();

    console.log('result is:', name);

    const subscription = (await user.bla()).subscribe((next) => {
        console.log('next', next);
    }, (error: any) => {
        console.error('error', error);
    }, () => {
        console.log('complete');
    });

    setTimeout(() => {
        subscription.unsubscribe();
    }, 5000);

    const users = await user.users();

    await users.ready.toPromise(); //convert to promise

    console.log('users', users.all());

    // socket.disconnect();
})();
