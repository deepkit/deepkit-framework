import {entity, t} from '@deepkit/marshal';
import {User} from './user';


@entity.name('user-credentials')
export class UserCredentials {
    @t password: string = '';

    constructor(@t.type(() => User).primary.reference() public user: User) {
    }
}