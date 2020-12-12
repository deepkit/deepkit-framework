import {expect, test} from '@jest/globals';
import 'reflect-metadata';
import {Entity, t} from '@deepkit/type';
import {createDatabase} from './utils';
import {getInstanceState} from '@deepkit/orm';

@Entity('image')
class Image {
    @t.array(() => User).backReference()
    users: User[] = [];

    @t.array(() => User).backReference({via: () => UserPicture})
    usersForPictures: User[] = [];

    constructor(
        @t.primary public id: number,
        @t public path: string,
    ) {
    }
}

@Entity('user')
class User {
    @t.reference().optional
    profileImage?: Image;

    @t.array(Image).optional.backReference({via: () => UserPicture})
    pictures?: Image[];

    constructor(
        @t.primary public id: number,
        @t public username: string,
    ) {
    }
}

@Entity('userImage')
class UserPicture {
    @t id!: number;

    constructor(
        @t.reference() user: User,
        @t.reference() image: Image,
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

    expect(getInstanceState(peter).isKnownInDatabase()).toBe(true);
    expect(getInstanceState(image1).isKnownInDatabase()).toBe(true);

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
