import { BackReference, entity, PrimaryKey, UUID, uuid } from '@deepkit/type';
import { UserCredentials } from './credentials';

@entity.name('b-user')
export class User {
    id: UUID & PrimaryKey = uuid();

    //one-to-one reference
    credentials: UserCredentials & BackReference = new UserCredentials(this);

    constructor(public name: string, public password?: string) {
        if (password) this.credentials.password = password;
    }
}
