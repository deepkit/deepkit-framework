import 'reflect-metadata';
import { DatabaseFactory } from './test';
import { entity, t } from '@deepkit/type';
import { expect } from '@jest/globals';
import { getObjectKeysSize } from '@deepkit/core';

@entity.name('users_user')
class User {
    @t.primary.autoIncrement public id: number = 0;
    @t created: Date = new Date;

    @t.array(() => Post).backReference()
    posts?: Post[];

    @t.array(() => Group).backReference({via: () => UserGroup})
    groups?: Group[];

    constructor(@t public username: string) {
    }
}

@entity.name('users_group')
class Group {
    @t.primary.autoIncrement public id: number = 0;

    constructor(@t public name: string) {
    }
}

@entity.name('users_userGroup')
class UserGroup {
    @t.primary.autoIncrement public id: number = 0;

    constructor(
        @t.reference() public user: User,
        @t.reference() public group: Group,
    ) {
    }
}

@entity.name('users_post')
class Post {
    @t.primary.autoIncrement public id: number = 0;
    @t created: Date = new Date;

    constructor(
        @t.reference() public author: User,
        @t public title: string) {
    }
}

const entities = [User, Group, UserGroup, Post];

export const usersTests = {
    async createDatabase(databaseFactory: DatabaseFactory) {
        const database = await databaseFactory(entities);

        const user1 = new User('User1');
        const user2 = new User('User2');
        const group1 = new Group('Group1');

        await database.persist(user1, user2, group1, new UserGroup(user1, group1), new UserGroup(user2, group1));

        {
            const users = await database.query(User).find();
            expect(users.length).toBe(2);
            expect(() => users[0].groups).toThrow('Reference User.groups was not populated');
        }

        {
            const users = await database.query(User).joinWith('groups').find();
            expect(users.length).toBe(2);
            expect(users[0].groups!.length).toBe(1);
            expect(users[1].groups!.length).toBe(1);
        }

        {
            const q = database.query(User).select('username', 'groups');
            const users = await database.query(User).select('username', 'groups').joinWith('groups').find();
            expect(users.length).toBe(2);
            expect(getObjectKeysSize(users[0])).toBe(3);
            expect(users[0].username).toBe('User1');
            expect(users[0].groups!.length).toBe(1);
            expect(users[1].groups!.length).toBe(1);
        }
    },
    async createSession(databaseFactory: DatabaseFactory) {
        const database = await databaseFactory(entities);
        const session = database.createSession();

        const user1 = new User('User1');
        const user2 = new User('User2');
        const group1 = new Group('Group1');

        session.add(user1, user2, group1, new UserGroup(user1, group1), new UserGroup(user2, group1));
        await session.commit();

        {
            const users = await session.query(User).disableIdentityMap().find();
            expect(users.length).toBe(2);
            expect(() => users[0].groups).toThrow('Reference User.groups was not populated');
        }

        {
            const users = await session.query(User).disableIdentityMap().joinWith('groups').find();
            expect(users.length).toBe(2);
            expect(users[0].groups!.length).toBe(1);
            expect(users[1].groups!.length).toBe(1);
        }

        {
            const users = await session.query(User).disableIdentityMap().select('username', 'groups').joinWith('groups').find();
            expect(users.length).toBe(2);
            expect(getObjectKeysSize(users[0])).toBe(3);
            expect(users[0].username).toBe('User1');
            expect(users[0].groups!.length).toBe(1);
            expect(users[1].groups!.length).toBe(1);
        }
    },
};
