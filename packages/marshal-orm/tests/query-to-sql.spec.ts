import 'jest';
import {getClassSchema, plainSerializer, t} from '@super-hornet/marshal';
import {QueryToSql} from '../src/query-filter';
import {escape} from 'sqlstring';

function quoteId(value: string): string {
    return value;
}

test('QueryToSql', () => {
    const User = t.class({
        id: t.number,
        username: t.string,
        password: t.string,
        disabled: t.boolean,
        created: t.date,
    });

    const queryToSql = new QueryToSql(getClassSchema(User), quoteId('user'), plainSerializer, escape, quoteId);

    expect(queryToSql.convert({id: 123})).toBe(`user.id = 123`);
    expect(queryToSql.convert({id: '$id'})).toBe(`user.id = user.id`);

    expect(queryToSql.convert({username: 'Peter'})).toBe(`user.username = 'Peter'`);
    expect(queryToSql.convert({id: 44, username: 'Peter'})).toBe(`(user.id = 44 AND user.username = 'Peter')`);

    expect(queryToSql.convert({$or: [{id: 44}, {username: 'Peter'}]})).toBe(`(user.id = 44 OR user.username = 'Peter')`);
    expect(queryToSql.convert({$and: [{id: 44}, {username: 'Peter'}]})).toBe(`(user.id = 44 AND user.username = 'Peter')`);

    expect(queryToSql.convert({id: {$ne: 44}})).toBe(`user.id != 44`);
    expect(queryToSql.convert({id: {$eq: 44}})).toBe(`user.id = 44`);
    expect(queryToSql.convert({id: {$gt: 44}})).toBe(`user.id > 44`);
    expect(queryToSql.convert({id: {$gte: 44}})).toBe(`user.id >= 44`);
    expect(queryToSql.convert({id: {$lt: 44}})).toBe(`user.id < 44`);
    expect(queryToSql.convert({id: {$lte: 44}})).toBe(`user.id <= 44`);
    expect(queryToSql.convert({id: {$in: [44, 55]}})).toBe(`user.id IN (44,55)`);
    expect(queryToSql.convert({id: {$nin: [44, 55]}})).toBe(`user.id NOT IN (44,55)`);

    expect(() => queryToSql.convert({id: {$oasdads: 123}})).toThrow('not supported');

});