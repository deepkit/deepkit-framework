import {Entity, f, uuid} from "@marcj/marshal";
import {User} from "./user";

@Entity('b-user-credentials')
export class UserCredentials {
    @f.uuid().primary()
    id: string = uuid();

    @f password: string = '';

    constructor(
        //one-to-one
        @f.forward(() => User).reference()
        public user: User,
    ) {
    }
}
