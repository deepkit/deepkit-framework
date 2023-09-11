import { AutoIncrement, BackReference, entity, PrimaryKey, Reference } from '@deepkit/type';
import { UserCredentials } from './user-credentials.js';
import { Group } from './group.js';

@entity.name('user')
export class User {
    public id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;

    firstName: string = '';
    lastName: string = '';
    email: string = '';
    birthdate?: Date;

    logins: number = 0;

    version: number = 0;

    credentials?: UserCredentials & BackReference;

    groups: Group[] & BackReference<{via: typeof UserGroup}> = [];

    constructor(public name: string) {
    }
}

@entity.name('user-group')
export class UserGroup {
    public id: number & AutoIncrement & PrimaryKey = 0;

    constructor(
        public user: User & Reference,
        public group: Group & Reference,
    ) {
    }
}
