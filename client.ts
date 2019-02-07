import {Collection, IdInterface} from "@kamille/core";
import {Observable} from "rxjs";
import {SocketClient} from "./src/socket";

class User implements IdInterface {
    id!: string;
    version!: number;

    name!: string;
}

interface UserInterface {
    name(): string;

    users(): Collection<User>;

    bla(): Observable<User[]>;
}

(async () => {
    const socket = new SocketClient();

    const user = socket.controller<UserInterface>('user');
    const name = await user.name();
    console.log('result is:', name);

    socket.disconnect();
})();
