import { Forward } from "@deepkit/core";
import {Entity, t, uuid} from "@deepkit/type";
import {UserCredentials} from "./credentials";

@Entity('b-user')
export class User {
    @t.uuid.primary
    id: string = uuid();

    //one-to-one reference
    @t.type(() => UserCredentials).backReference()
    credentials: Forward<UserCredentials> = new UserCredentials(this);

    constructor(@t public name: string, public password?: string) {
        if (password) this.credentials.password = password;
    }
}
