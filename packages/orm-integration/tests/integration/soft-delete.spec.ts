import { SoftDelete, SoftDeleteQuery } from '@deepkit/orm';
import { plainToClass, t } from '@deepkit/type';
import { test } from '@jest/globals';
import { createEnvSetup } from './setup';

// process.env['ADAPTER_DRIVER'] = 'mongo';

test('soft-delete', async () => {
    const s = t.schema({
        id: t.number.autoIncrement.primary,
        username: t.string,
        deletedAt: t.date.optional,
        deletedBy: t.string.optional,
    }, { name: 'softDeleteUser' });

    const database = await createEnvSetup([s]);
    const softDelete = new SoftDelete(database);
    softDelete.enable(s);

    await database.persist(plainToClass(s, { id: 1, username: 'Peter' }));
    await database.persist(plainToClass(s, { id: 2, username: 'Joe' }));
    await database.persist(plainToClass(s, { id: 3, username: 'Lizz' }));

    expect(await database.query(s).count()).toBe(3);

    await database.query(s).filter({ id: 1 }).deleteOne();
    expect(await database.query(s).count()).toBe(2);

    //soft delete using deletedBy
    await SoftDeleteQuery.from(database.query(s)).filter({ id: 2 }).deletedBy('me').deleteOne();
    expect(await database.query(s).count()).toBe(1);
    {
        const deleted2 = await SoftDeleteQuery.from(database.query(s)).withSoftDeleted().filter({id: 2}).findOne();
        expect(deleted2.id).toBe(2);
        expect(deleted2.deletedAt).not.toBe(undefined);
        expect(deleted2.deletedBy).toBe('me');
    }

    //restore first
    await SoftDeleteQuery.from(database.query(s).filter({ id: 1 })).restoreOne();
    expect(await database.query(s).count()).toBe(2);

    //restore all
    await SoftDeleteQuery.from(database.query(s)).restoreMany();
    expect(await database.query(s).count()).toBe(3);
    {
        const deleted2 = await database.query(s).filter({id: 2}).findOne();
        expect(deleted2.deletedBy).toBe(undefined);
    }

    //soft delete everything
    await database.query(s).deleteMany();
    expect(await database.query(s).count()).toBe(0);
    expect(await SoftDeleteQuery.from(database.query(s)).withSoftDeleted().count()).toBe(3);

    //hard delete everything
    await SoftDeleteQuery.from(database.query(s)).withSoftDeleted().deleteMany();
    expect(await database.query(s).count()).toBe(0);
    expect(await SoftDeleteQuery.from(database.query(s)).withSoftDeleted().count()).toBe(0);
});
