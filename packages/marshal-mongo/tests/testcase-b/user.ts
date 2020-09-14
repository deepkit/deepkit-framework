import {Entity, t, uuid} from "@deepkit/marshal";
import {UserCredentials} from "./credentials";

@Entity('b-user')
export class User {
    @t.uuid.primary
    id: string = uuid();

    //one-to-one reference
    @t.backReference()
    credentials: UserCredentials = new UserCredentials(this);

    constructor(@t public name: string, public password?: string) {
        if (password) this.credentials.password = password;
    }
}
