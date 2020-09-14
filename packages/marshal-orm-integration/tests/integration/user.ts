import {entity, t} from '@deepkit/marshal';
import {UserCredentials} from './user-credentials';

@entity.name('user')
export class User {
    @t.primary.autoIncrement public id?: number;
    @t created: Date = new Date;

    @t firstName: string = '';
    @t lastName: string = '';
    @t email: string = '';
    @t.optional birthdate?: Date;

    @t.type(() => UserCredentials).optional.backReference() credentials?: UserCredentials;

    constructor(
        @t public name: string,
    ) {
    }
}