import {expect, test} from '@jest/globals';
import {plainToClass, t} from '../index';
import 'reflect-metadata';

test('slice exclude', () => {
    const schema = t.schema({
        username: t.string,
        password: t.string,
        created: t.date,
    });

    expect(schema.hasProperty('password')).toBe(true);
    expect(schema.hasProperty('username')).toBe(true);
    expect(schema.hasProperty('created')).toBe(true);

    const pub = schema.exclude('password');
    expect(pub.hasProperty('password')).toBe(false);
    expect(pub.hasProperty('username')).toBe(true);
    expect(pub.hasProperty('created')).toBe(true);

    {
        const instance = plainToClass(pub, {username: 'Peter'});
        expect(instance.username).toBe('Peter');
        expect((instance as any).password).toBe(undefined);
    }

    {
        const instance = plainToClass(pub, {username: 'Peter', password: 'asdasd'});
        expect(instance.username).toBe('Peter');
        expect((instance as any).password).toBe(undefined);
    }
});

test('slice extend', () => {
    const schema = t.schema({
        username: t.string,
        password: t.string,
        created: t.date,
    });

    const pub = schema.extend({logins: t.number.default(0)});
    expect(pub.hasProperty('logins')).toBe(true);
    expect(pub.getProperty('logins').type).toBe('number');
    expect(pub.hasProperty('password')).toBe(true);
    expect(pub.hasProperty('username')).toBe(true);
    expect(pub.hasProperty('created')).toBe(true);

    {
        const instance = plainToClass(pub, {username: 'Peter'});
        expect(instance.username).toBe('Peter');
        expect(instance.logins).toBe(0);
    }

    {
        const instance = plainToClass(pub, {username: 'Peter', logins: 10});
        expect(instance.username).toBe('Peter');
        expect(instance.logins).toBe(10);
    }
});
