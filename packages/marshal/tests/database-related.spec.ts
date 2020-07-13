import 'jest-extended';
import 'reflect-metadata';
import {Entity, f, getClassSchema, MultiIndex} from "../src/decorators";
import {uuid} from "../src/utils";
import {getCollectionName} from "../src/mapper";


@Entity('user2')
class User {
    @f.uuid().primary()
    id: string = uuid();

    @f.forwardArray(() => Organisation).backReference({via: () => OrganisationMembership})
    organisations: Organisation[] = [];

    //self reference
    @f.optional().reference()
    manager?: User;

    @f.array(User).backReference()
    managedUsers: User[] = [];

    constructor(@f public name: string) {
    }
}

@Entity('organisation2', 'organisations2')
class Organisation {
    @f.uuid().primary()
    id: string = uuid();

    @f.array(User).backReference({mappedBy: 'organisations', via: () => OrganisationMembership})
    users: User[] = [];

    constructor(
        @f public name: string,
        @f.reference() public owner: User,
    ) {
    }
}

@Entity('organisation_member2')
@MultiIndex(['user', 'organisation'])
class OrganisationMembership {
    @f.uuid().primary()
    id: string = uuid();

    constructor(
        @f.reference().index() public user: User,
        @f.reference().index() public organisation: Organisation,
    ) {
    }
}

test('test primaryKeyStuff', async () => {
    const userSchema = getClassSchema(User);
    const item = new User('asd');

    expect(userSchema.getPrimaryFieldRepresentation(item)).toEqual({id: item.id});

});

test('test reverse ref', async () => {
    const userSchema = getClassSchema(User);
    const organisationSchema = getClassSchema(Organisation);
    const pivotSchema = getClassSchema(OrganisationMembership);

    expect(getCollectionName(Organisation)).toBe('organisations2');

    {
        const backRef = userSchema.findReverseReference(User, userSchema.getProperty('managedUsers'));
        expect(backRef.name).toBe('manager');
    }

    {
        const backRef = userSchema.findReverseReference(User, userSchema.getProperty('manager'));
        expect(backRef.getForeignKeyName()).toBe('managedUsers');
        expect(backRef.name).toBe('managedUsers');
    }

    {
        const backRef = organisationSchema.findReverseReference(User, userSchema.getProperty('organisations'));
        expect(backRef.name).toBe('users');
    }

    {
        //test pivot resolution
        //from user.organisations, OrganisationMembership->User (join to the left)
        const backRef = pivotSchema.findReverseReference(User, userSchema.getProperty('organisations'));
        expect(backRef.name).toBe('user');
    }

    {
        //test pivot resolution
        //from user.organisations, OrganisationMembership->Organisation (join to the right)
        const backRef = pivotSchema.findReverseReference(Organisation, userSchema.getProperty('organisations'));
        expect(backRef.name).toBe('organisation');
    }


    {
        //test regular OrganisationMembership->Organisation, from Organisation.users
        const backRef = pivotSchema.findReverseReference(Organisation, organisationSchema.getProperty('users'));
        expect(backRef.name).toBe('organisation');
    }

    //probably wrong
    {
        const backRef = userSchema.findReverseReference(Organisation, organisationSchema.getProperty('owner'));
        //todo, this is probably not correct
        expect(backRef.name).toBe('organisations');
    }
});
