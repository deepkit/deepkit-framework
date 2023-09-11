import { entity, PrimaryKey, Reference } from '@deepkit/type';
import { User } from './user.js';


@entity.name('user-credentials')
export class UserCredentials {
    password: string = '';

    constructor(public user: User & PrimaryKey & Reference) {
    }
}
