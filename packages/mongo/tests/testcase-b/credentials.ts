import {Entity, t, uuid} from "@deepkit/type";
import {User} from "./user";

@Entity('b-user-credentials')
export class UserCredentials {
    @t.uuid.primary
    id: string = uuid();

    @t password: string = '';

    constructor(
        //one-to-one
        @t.type(() => User).reference()
        public user: User,
    ) {
    }
}
