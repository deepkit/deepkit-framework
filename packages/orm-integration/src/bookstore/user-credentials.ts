import { entity, PrimaryKey, Reference, t } from '@deepkit/type';
import { User } from './user';


@entity.name('user-credentials')
export class UserCredentials {
    @t password: string = '';

    constructor(@t.type(() => User).primary.reference() public user: User) {
    }
}
