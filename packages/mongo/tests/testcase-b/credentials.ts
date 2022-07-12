import { entity, PrimaryKey, Reference, t, UUID, uuid } from '@deepkit/type';
import { User } from './user.js';

@entity.name('b-user-credentials')
export class UserCredentials {
    id: UUID & PrimaryKey = uuid();

    @t password: string = '';

    constructor(
        //one-to-one
        public user: User & Reference,
    ) {
    }
}
