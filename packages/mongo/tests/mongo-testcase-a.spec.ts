import { expect, test } from '@jest/globals';

import { getInstanceStateFromItem, hydrateEntity } from '@deepkit/orm';
import {
    BackReference,
    Index,
    PrimaryKey,
    Reference,
    ReflectionClass,
    UUID,
    entity,
    resolveForeignReflectionClass,
    uuid,
} from '@deepkit/type';

import { createDatabase } from './utils.js';

Error.stackTraceLimit = 20;

@entity.name('user2')
class User {
    id: UUID & PrimaryKey = uuid();
    organisations: Organisation[] & BackReference<{ via: typeof OrganisationMembership }> = [];
    //self reference
    manager?: User & Reference;
    managedUsers: User[] & BackReference = [];

    constructor(public name: string) {}
}

@entity.name('organisation2')
class Organisation {
    id: UUID & PrimaryKey = uuid();

    users: User[] & BackReference<{ mappedBy: 'organisations'; via: typeof OrganisationMembership }> = [];

    constructor(
        public name: string,
        public owner: User & Reference,
    ) {}
}

@entity.name('organisation_member2')
class OrganisationMembership {
    id: UUID & PrimaryKey = uuid();

    constructor(
        public user: User & Reference & Index,
        public organisation: Organisation & Reference & Index,
    ) {}
}

async function setupTestCase(name: string) {
    const db = await createDatabase(name);
    const session = db.createSession();

    const admin = new User('admin');
    const marc = new User('marc');
    const peter = new User('peter');
    const marcel = new User('marcel');

    const microsoft = new Organisation('Microsoft', admin);
    const apple = new Organisation('Apple', admin);

    session.add(admin);
    session.add(marc);
    session.add(peter);
    session.add(marcel);

    session.add(microsoft);
    session.add(apple);

    session.add(new OrganisationMembership(marc, apple));
    session.add(new OrganisationMembership(marc, microsoft));
    session.add(new OrganisationMembership(peter, microsoft));
    session.add(new OrganisationMembership(marcel, microsoft));
    await session.commit();

    return {
        db,
        session,
        admin,
        marc,
        peter,
        marcel,
        microsoft,
        apple,
    };
}

test('check if foreign keys are deleted correctly', async () => {
    const { db } = await setupTestCase('check if foreign keys are deleted correctly');

    const manager = new User('manager');
    await db.persist(manager);

    {
        const marc = await db.query(User).filter({ name: 'marc' }).findOne();
        expect(marc.manager).toBeUndefined();

        marc.manager = manager;
        expect(marc.manager).toBe(manager);
        await db.persist(marc);
    }

    {
        const marc = await db.query(User).filter({ name: 'marc' }).findOne();
        expect(marc.manager!.id).toBe(manager.id);
    }

    {
        const marc = await db.query(User).joinWith('manager').filter({ name: 'marc' }).findOne();
        expect(marc.manager!.id).toBe(manager.id);
        expect(marc.manager!.name).toBe('manager');
    }

    {
        const marc = await db.query(User).filter({ name: 'marc' }).findOne();
        marc.manager = undefined;

        await db.persist(marc);
    }

    {
        const marc = await db.query(User).filter({ name: 'marc' }).findOne();
        expect(marc.manager).toBeUndefined();
    }
});

test('disabled identity map', async () => {
    const { session, marc, peter, marcel } = await setupTestCase('disabled identity map');

    const manager1 = new User('manager1');
    session.add(manager1);
    await session.commit();
    session.withIdentityMap = false;

    expect(await session.query(User).count()).toBe(5);

    marc.manager = manager1;
    session.add(marc);
    await session.commit();
    expect(await session.query(User).count()).toBe(5);

    peter.manager = manager1;
    session.add(peter);
    await session.commit();

    marcel.manager = manager1;
    session.add(marcel);
    await session.commit();

    {
        const item = await session.query(User).filter({ name: 'marc' }).findOne();
        expect(item).not.toBe(marc);
        expect(item.id).toBe(marc.id);
        expect(item.manager!.id).toBe(manager1.id);
    }

    {
        const item = await session.query(User).filter({ id: manager1.id }).findOne();
        expect(item).not.toBe(manager1);
        expect(item).toBeInstanceOf(User);
        expect(item.id).toBe(manager1.id);
        expect(() => item.managedUsers).toThrow('managedUsers was not populated');
    }

    {
        const item = await session.query(User).joinWith('managedUsers').filter({ id: manager1.id }).findOne();
        expect(item.managedUsers.length).toBe(3);
        expect(item.managedUsers[0]).toBeInstanceOf(User);
        expect(item.managedUsers[0].id).toBe(marc.id);
    }
});

test('parameters', async () => {
    const { db, admin, marc, peter, marcel, apple, microsoft } = await setupTestCase('parameters');
    const session = db.createSession();

    await expect(
        session
            .query(User)
            .filter({ name: { $parameter: 'name' } })
            .find(),
    ).rejects.toThrow('Parameter name not defined');

    {
        const query = session.query(User).filter({ name: { $parameter: 'name' } });
        const marc = await query.parameter('name', 'marc').findOne();
        expect(marc.name).toBe('marc');

        const peter = await query.parameter('name', 'peter').findOne();
        expect(peter.name).toBe('peter');

        const marcel = await query.parameters({ name: 'marcel' }).findOne();
        expect(marcel.name).toBe('marcel');
    }
});

test('hydrate', async () => {
    const { db, admin, marc, peter, marcel, apple, microsoft } = await setupTestCase('hydrate');
    const session = db.createSession();

    {
        const item = await session
            .query(OrganisationMembership)
            .filter({
                user: marc,
                organisation: apple,
            })
            .disableIdentityMap()
            .findOne();

        expect(item).toBeInstanceOf(OrganisationMembership);
        expect(item.user.id).toBe(marc.id);
        expect(item.organisation.id).toBe(apple.id);
        expect(() => item.user.name).toThrow(`Can not access User.name since class was not completely hydrated`);

        await hydrateEntity(item.user);
        expect(item.user.name).toBe('marc');
    }

    {
        expect(session.withIdentityMap).toBe(true);

        //test automatic hydration. item.user should be picked up from the identity map, and thus fully hydrated
        {
            const marcFromDb = await session.query(User).filter({ name: 'marc' }).findOne();
            const item = await session
                .query(OrganisationMembership)
                .filter({
                    user: marc,
                    organisation: apple,
                })
                .findOne();
            expect(item).toBeInstanceOf(OrganisationMembership);
            expect(item.user.id).toBe(marcFromDb.id);
            expect(item.user.name).toBe('marc');
            expect(item.user).toBe(marcFromDb);
            expect(item.organisation.id).toBe(apple.id);
        }

        session.identityMap.clear();

        //test automatic hydration
        {
            const item = await session
                .query(OrganisationMembership)
                .filter({
                    user: marc,
                    organisation: apple,
                })
                .findOne();

            expect(item).toBeInstanceOf(OrganisationMembership);
            expect(item.user.id).toBe(marc.id);
            expect(item.organisation.id).toBe(apple.id);
            expect(() => item.user.name).toThrow(`Can not access User.name since class was not completely hydrated`);
            expect(getInstanceStateFromItem(item.user).getLastKnownPK()).toEqual({ id: item.user.id });
            expect(session.identityMap.isKnown(item.user)).toBe(true);

            //this will hydrate all related proxy objects
            const items = await session.query(User).filter({ name: 'marc' }).find();
            expect(items[0]).toBe(item.user);
        }
    }
});

test('joins', async () => {
    const { session, admin, marc, peter, marcel, apple, microsoft } = await setupTestCase('joins');

    expect('_id' in marc).toBe(false);
    expect(await session.query(User).count()).toBe(4);
    expect(await session.query(Organisation).count()).toBe(2);
    expect(await session.query(OrganisationMembership).count()).toBe(4);

    expect(await session.query(OrganisationMembership).filter({ user: marc }).count()).toBe(2);
    expect(await session.query(OrganisationMembership).filter({ user: peter }).count()).toBe(1);
    expect(await session.query(OrganisationMembership).filter({ user: marcel }).count()).toBe(1);

    expect(await session.query(OrganisationMembership).filter({ organisation: apple }).count()).toBe(1);
    expect(await session.query(OrganisationMembership).filter({ organisation: microsoft }).count()).toBe(3);

    expect(() => {
        session.query(Organisation).join('id' as any);
    }).toThrow('is not marked as reference');

    session.withIdentityMap = false;

    {
        const item = await session.query(User).findOne();
        expect(item.name).toEqual('admin');
        const name = await session.query(User).findOneField('name');
        expect(name).toEqual('admin');
    }

    {
        const item = await session.query(User).join('organisations').findOneField('name');
        expect(item).toEqual('admin');
    }

    {
        const item = await session.query(User).innerJoin('organisations').findOneField('name');
        expect(item).toEqual('marc');
    }

    {
        await expect(
            session.query(User).innerJoin('organisations').filter({ name: 'notexisting' }).findOneField('name'),
        ).rejects.toThrow('not found');
    }

    {
        const item = await session
            .query(User)
            .innerJoin('organisations')
            .filter({ name: 'notexisting' })
            .findOneFieldOrUndefined('name');
        expect(item).toBeUndefined();
    }

    {
        const items = await session.query(User).findField('name');
        expect(items).toEqual(['admin', 'marc', 'peter', 'marcel']);
    }

    {
        const items = await session.query(User).sort({ name: 'asc' }).findField('name');
        expect(items).toEqual(['admin', 'marc', 'marcel', 'peter']);
    }

    {
        const items = await session.query(User).sort({ name: 'desc' }).findField('name');
        expect(items).toEqual(['peter', 'marcel', 'marc', 'admin']);
    }

    await expect(session.query(User).filter({ name: 'notexisting' }).findOneField('name')).rejects.toThrow('not found');

    expect(await session.query(User).filter({ name: 'marc' }).has()).toBe(true);
    expect(await session.query(User).filter({ name: 'notexisting' }).has()).toBe(false);

    expect(await session.query(User).join('organisations').filter({ name: 'marc' }).has()).toBe(true);
    expect(await session.query(User).join('organisations').filter({ name: 'notexisting' }).has()).toBe(false);

    {
        const item = await session.query(User).filter({ name: 'notexisting' }).findOneFieldOrUndefined('name');
        expect(item).toBeUndefined();
    }

    {
        const schema = ReflectionClass.from(OrganisationMembership);
        expect(schema.getProperty('user').getResolvedReflectionClass().getClassType()).toBe(User);
        const query = session.query(OrganisationMembership).joinWith('user');

        const resolvedType = resolveForeignReflectionClass(query.model.joins[0].propertySchema).getClassType();
        expect(resolvedType).toBe(User);
        expect(resolvedType === User).toBe(true);

        const schema2 = ReflectionClass.from(resolvedType);
        expect(schema2.name).toBe('user2');
        expect(schema2.getClassType()).toBe(User);
        expect(resolveForeignReflectionClass(query.model.joins[0].propertySchema).getClassType()).toBe(User);
    }

    {
        const items = await session.query(OrganisationMembership).joinWith('user').find();
        expect(items.length).toBe(4);
        expect(items[0].user).toBeInstanceOf(User);
        expect(items[0].user).toBe(items[1].user); //marc === marc instance

        expect(items[0].user).toBeInstanceOf(User);
        expect(items[0].user!.id).toBe(marc.id);
        expect(items[0].user!.name).toBe(marc.name);

        const count = await session.query(OrganisationMembership).joinWith('user').count();
        expect(count).toBe(4);
    }

    {
        const items = await session.query(OrganisationMembership).filter({ user: peter }).joinWith('user').find();
        expect(items.length).toBe(1);
        expect(items[0].user.id).toBe(peter.id);
        expect(items[0].organisation.id).toBe(microsoft.id);
    }

    {
        const item = await session.query(OrganisationMembership).filter({ user: peter }).joinWith('user').findOne();
        expect(item).not.toBeUndefined();
        expect(item.user.id).toBe(peter.id);
        expect(item.user.name).toBe(peter.name);
        expect(item.organisation.id).toBe(microsoft.id);
        expect(() => {
            item.organisation.name;
        }).toThrow(`Can not access Organisation.name since class`);

        const count1 = await session.query(OrganisationMembership).filter({ user: peter }).joinWith('user').count();
        expect(count1).toBe(1);

        const count2 = await session.query(OrganisationMembership).filter({ user: peter }).count();
        expect(count2).toBe(1);
    }

    {
        const item = await session.query(OrganisationMembership).filter({ user: peter }).findOne();
        expect(item).not.toBeUndefined();
        expect(item.user.id).toBe(peter.id);
        expect(item.organisation.id).toBe(microsoft.id);
        expect(() => {
            item.user.name;
        }).toThrow(`Can not access User.name since class was not completely hydrated`);
        expect(() => {
            item.organisation.name;
        }).toThrow(`Can not access Organisation.name since class was not completely hydrated`);
    }

    {
        const items = await session.query(OrganisationMembership).innerJoin('user').find();
        expect(items.length).toBe(4);
    }

    {
        const items = await session
            .query(OrganisationMembership)
            .useJoinWith('user')
            .filter({ name: 'marc' })
            .end()
            .find();
        expect(items.length).toBe(4); //still 4, but user is empty for all other than marc
        expect(items[0].user).toBeInstanceOf(User);
        expect(items[1].user).toBeInstanceOf(User);
        expect(items[2].user).toBeUndefined();
        expect(items[3].user).toBeUndefined();
    }

    {
        const items = await session
            .query(OrganisationMembership)
            .useInnerJoin('user')
            .filter({ name: 'marc' })
            .end()
            .find();

        expect(items.length).toBe(2);
        expect(() => {
            items[0].user.name;
        }).toThrow('not completely hydrated');

        expect(() => {
            items[1].user.name;
        }).toThrow('not completely hydrated');
    }

    {
        const query = await session
            .query(OrganisationMembership)
            .useInnerJoinWith('user')
            .select('id')
            .filter({ name: 'marc' })
            .end();

        {
            const items = await query.find();
            expect(items.length).toBe(2);
            expect(items[0].user).not.toBeInstanceOf(User);
            expect(items[1].user).not.toBeInstanceOf(User);

            expect(items[0].user).toEqual({ id: marc.id });
        }

        {
            const items = await query.clone().find();
            expect(items.length).toBe(2);
            expect(items[0].user).not.toBeInstanceOf(User);
            expect(items[1].user).not.toBeInstanceOf(User);

            expect(items[0].user).toEqual({ id: marc.id });
        }
    }

    {
        const items = await session.query(User).innerJoinWith('organisations').find();

        expect(items[0].organisations.length).toBe(2);
        expect(items[0].organisations[0]).toBeInstanceOf(Organisation);
        expect(items[0].organisations[0].name).toBe('Microsoft');
        expect(items[0].organisations[1]).toBeInstanceOf(Organisation);
        expect(items[0].organisations[1].name).toBe('Apple');

        expect(items[1].organisations.length).toBe(1);
        expect(items[1].organisations[0]).toBeInstanceOf(Organisation);
        expect(items[1].organisations[0].name).toBe('Microsoft');

        expect(items[0].organisations[0]).toBe(items[1].organisations[0]); //microsoft the same instance
    }

    {
        const items = await session
            .query(User)
            .useInnerJoinWith('organisations')
            .filter({ name: 'Microsoft' })
            .end()
            .find();
        expect(items[0].organisations.length).toBe(1);
        expect(items[0].organisations[0]).toBeInstanceOf(Organisation);
        expect(items[0].organisations[0].name).toBe('Microsoft');

        expect(items[1].organisations.length).toBe(1);
        expect(items[1].organisations[0]).toBeInstanceOf(Organisation);
        expect(items[1].organisations[0].name).toBe('Microsoft');

        expect(items[0].organisations[0]).toBe(items[1].organisations[0]); //microsoft the same instance
    }

    {
        const items = await session.query(Organisation).useJoinWith('users').end().find();
        expect(items.length).toBe(2);
        expect(items[0].name).toBe('Microsoft');
        expect(items[1].name).toBe('Apple');

        expect(items[0].users.length).toBe(3);
        expect(items[1].users.length).toBe(1);
    }

    {
        const items = await session.query(Organisation).useInnerJoinWith('users').end().find();
        expect(items.length).toBe(2);
        expect(items[0].name).toBe('Microsoft');
        expect(items[1].name).toBe('Apple');

        expect(items[0].users.length).toBe(3);
        expect(items[1].users.length).toBe(1);

        expect(items[0].users[0].name).toBe('marc');
        expect(items[0].users[1].name).toBe('peter');
        expect(items[0].users[2].name).toBe('marcel');
    }

    {
        const items = await session.query(Organisation).useInnerJoinWith('users').sort({ name: 'asc' }).end().find();
        expect(items.length).toBe(2);
        expect(items[0].name).toBe('Microsoft');
        expect(items[1].name).toBe('Apple');

        expect(items[0].users.length).toBe(3);
        expect(items[1].users.length).toBe(1);

        expect(items[0].users[0].name).toBe('marc');
        expect(items[0].users[1].name).toBe('marcel');
        expect(items[0].users[2].name).toBe('peter');
    }

    {
        const items = await session.query(Organisation).useJoinWith('users').sort({ name: 'asc' }).skip(1).end().find();
        expect(items.length).toBe(2);
        expect(items[0].name).toBe('Microsoft');
        expect(items[1].name).toBe('Apple');

        expect(items[0].users.length).toBe(2);
        expect(items[1].users.length).toBe(0);

        expect(items[0].users[0].name).toBe('marcel');
        expect(items[0].users[1].name).toBe('peter');
    }

    {
        const items = await session
            .query(Organisation)
            .useJoinWith('users')
            .sort({ name: 'asc' })
            .skip(1)
            .limit(1)
            .end()
            .find();
        expect(items.length).toBe(2);
        expect(items[0].name).toBe('Microsoft');
        expect(items[1].name).toBe('Apple');

        expect(items[0].users.length).toBe(1);
        expect(items[1].users.length).toBe(0);

        expect(items[0].users[0].name).toBe('marcel');
    }

    {
        const items = await session.query(Organisation).useJoinWith('users').select('id').end().find();
        expect(items.length).toBe(2);
        expect(items[0].name).toBe('Microsoft');
        expect(items[1].name).toBe('Apple');

        expect(items[0].users.length).toBe(3);
        expect(items[1].users.length).toBe(1);

        expect(items[0].users[0]).not.toBeInstanceOf(User);
        expect(items[0].users[0].id).toBe(marc.id);
        expect(items[0].users[0].name).toBeUndefined();
    }

    {
        const query = session.query(OrganisationMembership).useInnerJoinWith('user').filter({ name: 'marc' }).end();

        const items = await query.find();
        expect(items.length).toBe(2); //we get 2 because of inner join
        expect(items[0].user).toBeInstanceOf(User);
        expect(items[1].user).toBeInstanceOf(User);

        const items2 = await query.joinWith('organisation').find();
        expect(items2.length).toBe(2); //still the same
        expect(items2[0].user).toBeInstanceOf(User);
        expect(items2[1].user).toBeInstanceOf(User);
    }

    {
        const query = session.query(OrganisationMembership).useInnerJoinWith('user').filter({ name: 'marc' }).end();

        const item = await query.findOne();
        expect(item.user).toBeInstanceOf(User);
        expect(item.user!.name).toBe('marc');
    }

    {
        const query = session.query(OrganisationMembership).filter({ user: marc });
        const items = await query.find();
        expect(items.length).toBe(2);
    }

    session.remove(peter);
    await session.commit();

    {
        const query = session.query(OrganisationMembership).joinWith('user').filter({ user: peter });
        const items = await query.find();
        expect(items.length).toBe(1);
        expect(await query.count()).toBe(1);
    }

    {
        expect(await session.query(OrganisationMembership).innerJoin('user').filter({ user: peter }).count()).toBe(0);
        expect(await session.query(OrganisationMembership).innerJoinWith('user').filter({ user: peter }).count()).toBe(
            0,
        );
    }

    {
        const query = session
            .query(OrganisationMembership)
            .useJoinWith('user')
            .filter({ name: 'marc' })
            .end()
            .joinWith('organisation');

        expect(query.model.joins.length).toBe(2);
        expect(resolveForeignReflectionClass(query.model.joins[0].propertySchema).getClassType()).toBe(User);
        expect(resolveForeignReflectionClass(query.model.joins[1].propertySchema).getClassType()).toBe(Organisation);

        const items = await query.find();
        expect(items.length).toBe(4); //we get all, because we got a left join
    }

    {
        const query = session.query(User).useInnerJoinWith('organisations').filter({ name: 'Microsoft' }).end();

        {
            const items = await query.clone().find();
            expect(items.length).toBe(2);
            expect(() => {
                expect(items[0].organisations[0].owner.name).toBeUndefined();
            }).toThrow('was not completely hydrated');
        }
        {
            const items = await query.find();
            expect(items.length).toBe(2);
            expect(items[0].name).toBe('marc');
            expect(items[0].organisations.length).toBe(1);
            expect(items[0].organisations[0].name).toBe('Microsoft');
            expect(() => {
                expect(items[0].organisations[0].owner.name).toBeUndefined();
            }).toThrow('was not completely hydrated');
            expect(items[1].name).toBe('marcel');
            expect(items[1].organisations.length).toBe(1);
            expect(items[1].organisations[0].name).toBe('Microsoft');
            expect(() => {
                expect(items[1].organisations[0].owner.name).toBeUndefined();
            }).toThrow('was not completely hydrated');
        }

        {
            const items = await query.clone().getJoin('organisations').joinWith('owner').end().find();
            expect(items.length).toBe(2);
            expect(items[0].name).toBe('marc');
            expect(items[0].organisations.length).toBe(1);
            expect(items[0].organisations[0].name).toBe('Microsoft');
            expect(items[0].organisations[0].owner).toBeInstanceOf(User);
            expect(items[1].name).toBe('marcel');
            expect(items[1].organisations.length).toBe(1);
            expect(items[1].organisations[0].name).toBe('Microsoft');
            expect(items[1].organisations[0].owner).toBeInstanceOf(User);
            expect(items[1].organisations[0].owner).toBe(items[0].organisations[0].owner);
            expect(items[1].organisations[0].owner.name).toBe('admin');
            expect(items[1].organisations[0].owner.id).toBe(admin.id);
        }

        {
            const items = await query
                .clone()
                .getJoin('organisations')
                .useJoinWith('owner')
                .select('id')
                .end()
                .end()
                .find();
            expect(items.length).toBe(2);
            expect(items[0].name).toBe('marc');
            expect(items[0].organisations.length).toBe(1);
            expect(items[0].organisations[0].name).toBe('Microsoft');
            expect(items[0].organisations[0].owner).not.toBeInstanceOf(User);
            expect(items[1].name).toBe('marcel');
            expect(items[1].organisations.length).toBe(1);
            expect(items[1].organisations[0].name).toBe('Microsoft');
            expect(items[1].organisations[0].owner).not.toBeInstanceOf(User);
            expect(items[1].organisations[0].owner.name).toBeUndefined();
            expect(items[1].organisations[0].owner.id).toBe(admin.id);
        }

        {
            const item = await session.query(User).findOne();
            expect(() => item.organisations).toThrow('was not populated');
        }

        {
            const item = await session.query(User).joinWith('organisations').filter({ name: 'marc' }).findOne();
            expect(item.name).toBe('marc');
            expect(item.organisations.length).toBeGreaterThan(0);
        }

        {
            const item = await session.query(User).innerJoinWith('organisations').findOne();
            expect(item.name).toBe('marc');
            expect(item.organisations.length).toBeGreaterThan(0);
        }
    }
});
