import {entity, PrimaryKey, Reference, t} from '@deepkit/type';
import {UserCredentials} from './user-credentials';
import {Group} from './group';

@entity.name('user')
export class User {
    @t.primary.autoIncrement public id?: PrimaryKey<number>;
    @t created: Date = new Date;

    @t firstName: string = '';
    @t lastName: string = '';
    @t email: string = '';
    @t.optional birthdate?: Date;

    @t logins: number = 0;

    @t version: number = 0;

    @t.type(() => UserCredentials).optional.backReference()
    credentials?: Reference<UserCredentials>;

    @t.array(() => Group).backReference({via: () => UserGroup})
    groups: Reference<Group[]> = [];

    constructor(
        @t public name: string,
    ) {
    }
}

@entity.name('user-group')
export class UserGroup {
    @t.primary.autoIncrement public id?: PrimaryKey<number>;
    constructor(
        @t.reference() public user: Reference<User>,
        @t.reference() public group: Reference<Group>,
    ) {
    }
}
