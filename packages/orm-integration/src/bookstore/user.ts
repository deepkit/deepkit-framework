import { AutoIncrement, BackReference, entity, PrimaryKey, Reference } from '@deepkit/type';
import { UserCredentials } from './user-credentials';
import { Group } from './group';

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
        //todo: User is not correctly reflected. its an empty TypeObjectLiteral object
        public user: User & Reference,
        public group: Group & Reference,
    ) {
    }
}
