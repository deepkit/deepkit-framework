import { AutoIncrement, BackReference, MinLength, PrimaryKey, Reference, entity } from '@deepkit/type';

import { Group } from './group.js';
import { UserCredentials } from './user-credentials.js';

@entity.name('user')
export class User {
    public id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date();

    firstName: string = '';
    lastName: string = '';
    email: string = '';
    birthdate?: Date;

    logins: number = 0;

    version: number = 0;

    credentials?: UserCredentials & BackReference;

    groups: Group[] & BackReference<{ via: UserGroup }> = [];

    constructor(public username: string & MinLength<3>) {}
}

@entity.name('user-group')
export class UserGroup {
    public id: number & PrimaryKey & AutoIncrement = 0;

    constructor(
        public user: User & Reference,
        public group: Group & Reference,
    ) {}
}
