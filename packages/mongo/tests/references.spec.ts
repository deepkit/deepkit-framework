import { expect, test } from '@jest/globals';
import { BackReference, entity, PrimaryKey, Reference, ReflectionClass } from '@deepkit/type';
import { createDatabase } from './utils.js';
import { getInstanceStateFromItem } from '@deepkit/orm';

@entity.name('image')
class Image {
    users: User[] & BackReference = [];

    usersForPictures: User[] & BackReference<{via: typeof UserPicture}> = [];

    constructor(
        public id: number & PrimaryKey,
        public path: string,
    ) {
    }
}

@entity.name('user')
class User {
    profileImage?: Image & Reference;

    pictures?: Image[] & BackReference<{via: typeof UserPicture}>;

    constructor(
        public id: number & PrimaryKey,
        public username: string,
    ) {
    }
}

@entity.name('userImage')
class UserPicture {
    id!: number;

    constructor(
        public user: User & Reference,
        public image: Image & Reference,
    ) {
    }
}

test('test back reference', async () => {
    const db = await createDatabase('reference a');
    const session = db.createSession();

    const image1 = new Image(1, 'peter.png');
    const peter = new User(2, 'peter');
    peter.profileImage = image1;
    session.add(peter);

    await session.commit();

    const schema = ReflectionClass.from(Image);
    expect(schema.getProperty('users').isBackReference()).toBe(true);
    expect(schema.clone().getProperty('users').isBackReference()).toBe(true);

    expect(getInstanceStateFromItem(peter).isKnownInDatabase()).toBe(true);
    expect(getInstanceStateFromItem(image1).isKnownInDatabase()).toBe(true);

    {
        const images = await session.query(Image).disableIdentityMap().find();
        expect(images[0].id).toBe(1);
        expect(() => images[0].users[0].id).toThrow('Reference Image.users was not populated');
    }

    {
        const images = await session.query(Image).disableIdentityMap().joinWith('users').find();
        expect(images[0].id).toBe(1);
        expect(images[0].users[0].id).toBe(2);
        expect(images[0].users[0].username).toBe('peter');
    }

    {
        session.identityMap.clear();
        const images = await session.query(Image).find();
        expect(images[0].id).toBe(1);
        expect(() => images[0].users[0].id).toThrow('Reference Image.users was not populated');
    }

    {
        session.identityMap.clear();
        const images = await session.query(Image).joinWith('users').find();
        expect(images[0].id).toBe(1);
        expect(images[0].users[0].id).toBe(2);
        expect(images[0].users[0].username).toBe('peter');
    }
});

test('test unlink reference', async () => {
    const db = await createDatabase('reference a');
    const session = db.createSession();

    const image1 = new Image(1, 'peter.png');
    const peter = new User(2, 'peter');
    peter.profileImage = image1;
    session.add(peter);

    await session.commit();

    {
        session.identityMap.clear();
        const users = await session.query(User).find();
        expect(users[0].id).toBe(2);
        expect(users[0].profileImage!.id).toBe(1);
    }

    {
        session.identityMap.clear();
        const user = await session.query(User).findOne();
        user.profileImage = undefined;

        //user is managed, so no need to call add
        await session.commit();

        expect(user.profileImage!).toBe(undefined);

        {
            session.identityMap.clear();
            const user = await session.query(User).findOne();
            expect(user.profileImage!).toBe(undefined);
        }
    }
});
