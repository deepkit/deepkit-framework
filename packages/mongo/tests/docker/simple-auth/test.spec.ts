import { Database } from '@deepkit/orm';
import { entity, MongoId, PrimaryKey } from '@deepkit/type';
import { expect, test } from '@jest/globals';
import { MongoDatabaseAdapter } from '../../../src/lib/adapter.js';

test('simple-auth', async () => {
    class BaseEntity {
        id: MongoId & PrimaryKey = "507f1f77bcf86cd799439011";
        created: Date = new Date;
        updated: Date = new Date;

        static from<T extends typeof BaseEntity>(this: T, data: Partial<InstanceType<T>>): InstanceType<T> {
            return Object.assign(new this, data) as InstanceType<T>;
        }
    }

    @entity.name('user')
    class User extends BaseEntity {
        name!: string;
    }

    //todo: this doesn't work on Github actions at the moment
    // const database = new Database(new MongoDatabaseAdapter(`mongodb://user:password@127.0.0.1:27018/db`), [BaseEntity, User]);
    //
    // await database.migrate();
    // await database.query(User).deleteMany();
    //
    // const u: User = User.from({ name: 'test' });
    // await database.persist(u);
    //
    // const allUsers = await database.query(User).find();
    // expect(allUsers.length).toBe(1);
    // expect(allUsers[0]).not.toBe('');
    // expect(allUsers[0]).not.toBeUndefined();
    // expect(allUsers[0]).toMatchObject({
    //     name: 'test'
    // });
});
