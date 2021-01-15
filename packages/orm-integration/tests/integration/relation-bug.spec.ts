import 'reflect-metadata';
import { entity, getClassSchema, plainToClass, t } from '@deepkit/type';
import { test } from '@jest/globals';
import { createEnvSetup } from './setup';

test('relation bug spec', async () => {
    const cookieSchema = t.schema({
        id: t.number.autoIncrement.primary,
        type: t.string,
    }, { name: 'relationBugCookie' });

    const userSchema = t.schema({
        id: t.number.autoIncrement.primary,
        username: t.string,
        cookies: t.array(cookieSchema).optional,
    }, { name: 'relationBugUser' });

    const database = await createEnvSetup([userSchema, cookieSchema]);

    await database.persist(plainToClass(cookieSchema, { id: 1, type: 'Chocolate' }));
    await database.persist(plainToClass(cookieSchema, { id: 2, type: 'Vanilla' }));

    await database.persist(plainToClass(userSchema, { id: 1, username: 'Peter', cookies: [ 1 ] }));
    await database.persist(plainToClass(userSchema, { id: 2, username: 'Joe' , cookies: [ 2, 1 ]}));
    await database.persist(plainToClass(userSchema, { id: 3, username: 'Lizz' }));

    expect(await database.query(cookieSchema).count()).toBe(2);
    expect(await database.query(userSchema).count()).toBe(3);

    const joe = await database.query(userSchema).filter({ username: 'Joe' }).joinWith('cookies').findOne();
    expect(joe.cookies).toEqual([
        expect.objectContaining({ type: 'Vanilla' }),
        expect.objectContaining({ type: 'Chocolate' }),
    ]);
});

test('relation bug session', async () => {
    @entity.name('relationBugCookie2')
    class Cookie {
        @t.primary.autoIncrement id: number = 0;
        constructor(
            @t public type: string,
        ) { }
    }

    @entity.name('relationBugUser2')
    class User {
        @t.primary.autoIncrement id: number = 0;
        @t deletedAt?: Date;
        @t deletedBy?: string;
        @t.array(Cookie).optional cookies?: Cookie[];

        constructor(
            @t public username: string,
        ) { }
    }

    expect(getClassSchema(User).getProperty('id').type).toBe('number');
    const database = await createEnvSetup([User, Cookie]);

    const session = database.createSession();
    const chocolateCookie = new Cookie('Chocolate');
    const vanillaCookie = new Cookie('Vanilla');
    session.add(chocolateCookie, vanillaCookie);
    await session.commit();

    const peter = new User('peter');
    peter.cookies = [ chocolateCookie, vanillaCookie ];
    const joe = new User('Joe');
    joe .cookies = [ vanillaCookie ];
    const lizz = new User('Lizz');

    session.add(peter, joe, lizz);
    await session.commit();

    expect(await database.query(User).count()).toBe(3);
    expect(await database.query(Cookie).count()).toBe(2);

    {
        const peter = await session.query(User).joinWith('cookies').filter({ id: 1 }).findOne();
        expect(peter.cookies).toEqual([
            expect.objectContaining([
                { id: 1 },
            ]),
            expect.objectContaining([
                { id: 2 },
            ])
        ])
    }
});
