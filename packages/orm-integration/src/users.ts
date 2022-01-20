import 'reflect-metadata';
import { DatabaseFactory } from './test';
import { AutoIncrement, BackReference, entity, PrimaryKey, Reference } from '@deepkit/type';
import { expect } from '@jest/globals';
import { getObjectKeysSize } from '@deepkit/core';

@entity.name('users_user')
class User {
    public id: number & AutoIncrement & PrimaryKey = 0;
    created: Date = new Date;

    posts?: Post[] & BackReference;

    groups?: Group[] & BackReference<{via: typeof UserGroup}>;

    constructor(public username: string) {
    }
}

@entity.name('users_group')
class Group {
    public id: number & AutoIncrement & PrimaryKey = 0;

    constructor(public name: string) {
    }
}

@entity.name('users_userGroup')
class UserGroup {
    public id: number & AutoIncrement & PrimaryKey = 0;

    constructor(
        public user: User & Reference,
        public group: Group & Reference,
    ) {
    }
}

@entity.name('users_post')
class Post {
    public id: number & AutoIncrement & PrimaryKey = 0;
    created: Date = new Date;

    constructor(
        public author: User & Reference,
        public title: string) {
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
            const users = await database.query(User).select('username', 'groups').joinWith('groups').find();
            expect(users.length).toBe(2);
            expect(Object.keys(users[0]).length).toBe(2)
            expect(Object.keys(users[0])).toContain('username');
            expect(Object.keys(users[0])).toContain('groups');
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
            expect(getObjectKeysSize(users[0])).toBe(2);
            expect(users[0].username).toBe('User1');
            expect(users[0].groups!.length).toBe(1);
            expect(users[1].groups!.length).toBe(1);
        }
    },
};
