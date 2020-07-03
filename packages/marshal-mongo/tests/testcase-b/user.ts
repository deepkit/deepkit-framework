import {Entity, f, uuid} from "@marcj/marshal";
import {UserCredentials} from "./credentials";

@Entity('b-user')
export class User {
    @f.uuid().primary()
    id: string = uuid();

    //one-to-one reference
    @f.backReference()
    credentials: UserCredentials = new UserCredentials(this);

    constructor(@f public name: string, public password?: string) {
        if (password) this.credentials.password = password;
    }
}
