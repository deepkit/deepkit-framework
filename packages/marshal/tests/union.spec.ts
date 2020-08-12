import 'jest';
import 'reflect-metadata';
import {getJitFunctionXToClass, jitPlainToClass, plainToClass, t} from '../index';

test('union ClassType', () => {
    class RegularUser {
        @t.literal('regular')
        type!: 'regular';
    }

    class AdminUser {
        @t.literal('admin')
        type!: 'admin';
    }

    const s = t.schema({
        union: t.union(RegularUser, AdminUser),
    });

    {
        const item = plainToClass(s, {union: {type: 'regular'}});
        expect(item.union.type).toBe('regular');
        expect(item.union).toBeInstanceOf(RegularUser);
    }

    {
        const item = plainToClass(s, {union: {type: 'admin'}});
        expect(item.union.type).toBe('admin');
        expect(item.union).toBeInstanceOf(AdminUser);
    }
});

test('union ClassSchema', () => {
    const s = t.schema({
        union: t.union(
            t.schema({type: t.literal('regular')}),
            t.schema({type: t.literal('admin')}),
        ),
    });

    expect(s.getProperty('union').type).toBe('union');
    expect(s.getProperty('union').templateArgs[0].type).toBe('class');
    expect(s.getProperty('union').templateArgs[0].getResolvedClassSchema().getProperty('type').type).toBe('literal');
    expect(s.getProperty('union').templateArgs[0].getResolvedClassSchema().getProperty('type').literalValue).toBe('regular');

    expect(s.getProperty('union').templateArgs[1].getResolvedClassSchema().getProperty('type').type).toBe('literal');
    expect(s.getProperty('union').templateArgs[1].getResolvedClassSchema().getProperty('type').literalValue).toBe('admin');

    {
        const item = plainToClass(s, {union: {type: 'regular'}});
        expect(item.union.type).toBe('regular');
    }

    {
        const item = plainToClass(s, {union: {type: 'admin'}});
        expect(item.union.type).toBe('admin');
    }
});

test('union ClassSchema simple', () => {
    const s = t.schema({
        union: t.union(
            t.schema({type: 'regular'}),
            t.schema({type: 'admin'}),
        ),
    });

    expect(s.getProperty('union').type).toBe('union');
    expect(s.getProperty('union').templateArgs[0].type).toBe('class');
    expect(s.getProperty('union').templateArgs[0].getResolvedClassSchema().getProperty('type').type).toBe('literal');
    expect(s.getProperty('union').templateArgs[0].getResolvedClassSchema().getProperty('type').literalValue).toBe('regular');

    expect(s.getProperty('union').templateArgs[1].getResolvedClassSchema().getProperty('type').type).toBe('literal');
    expect(s.getProperty('union').templateArgs[1].getResolvedClassSchema().getProperty('type').literalValue).toBe('admin');

    {
        const item = plainToClass(s, {union: {type: 'regular'}});
        expect(item.union.type).toBe('regular');
    }

    {
        const item = plainToClass(s, {union: {type: 'admin'}});
        expect(item.union.type).toBe('admin');
    }
});

test('union ClassSchema simpler', () => {
    const s = t.schema({
        union: t.union(
            {type: 'regular'},
            {type: 'admin'},
        ),
    });

    expect(s.getProperty('union').type).toBe('union');
    expect(s.getProperty('union').templateArgs[0].type).toBe('class');
    expect(s.getProperty('union').templateArgs[0].getResolvedClassSchema().getProperty('type').type).toBe('literal');
    expect(s.getProperty('union').templateArgs[0].getResolvedClassSchema().getProperty('type').literalValue).toBe('regular');

    expect(s.getProperty('union').templateArgs[1].getResolvedClassSchema().getProperty('type').type).toBe('literal');
    expect(s.getProperty('union').templateArgs[1].getResolvedClassSchema().getProperty('type').literalValue).toBe('admin');
});

test('union literal', () => {
    const s = t.schema({
        union: t.union('a', 'b', 'c').default('a'),
    });
    expect(s.getProperty('union').type).toBe('union');
    expect(s.getProperty('union').templateArgs[0].type).toBe('literal');
    expect(s.getProperty('union').templateArgs[1].type).toBe('literal');
    expect(s.getProperty('union').templateArgs[2].type).toBe('literal');

    {
        const item = plainToClass(s, {union: 'a'});
        expect(item.union).toBe('a');
    }

    {
        const item = plainToClass(s, {union: 'b'});
        expect(item.union).toBe('b');
    }

    {
        const item = plainToClass(s, {union: 'c'});
        expect(item.union).toBe('c');
    }

    {
        const item = plainToClass(s, {union: '0'});
        expect(item.union).toBe('a');
    }
});

test('union literal and string', () => {
    const s = t.schema({
        union: t.union('a', t.string, 'b').default('a'),
    });

    {
        const item = plainToClass(s, {union: 'a'});
        expect(item.union).toBe('a');
    }

    {
        const item = plainToClass(s, {union: 'asdasd'});
        expect(item.union).toBe('asdasd');
    }

    {
        const item = plainToClass(s, {union: '0'});
        expect(item.union).toBe('0');
    }
});

test('union string | string[]', () => {
    const s = t.schema({
        union: t.union(t.string, t.array(t.string)),
    });

    {
        const item = plainToClass(s, {union: '123'});
        expect(item.union).toBe('123');
    }

    {
        const item = plainToClass(s, {union: ['455']});
        expect(item.union).toEqual(['455']);
    }
});

test('union string | string[][]', () => {
    const s = t.schema({
        union: t.union(t.string, t.array(t.array(t.string))),
    });

    // jitPlainToClass(s);
    // console.log(getJitFunctionXToClass(s, 'plain').toString());

    {
        const item = plainToClass(s, {union: '123'});
        expect(item.union).toBe('123');
    }

    {
        const item = plainToClass(s, {union: [['455'], ['4']]});
        expect(item.union).toEqual([['455'], ['4']]);
    }

    {
        const item = plainToClass(s, {union: [123]});
        expect(item.union).toEqual([[]]);
    }

    {
        const item = plainToClass(s, {union: ['455']});
        expect(item.union).toEqual([[]]);
    }
});

test('union string | map', () => {
    const s = t.schema({
        union: t.union(t.string, t.map(t.string)),
    });

    {
        const item = plainToClass(s, {union: '123'});
        expect(item.union).toBe('123');
    }

    {
        const item = plainToClass(s, {union: {a: '455'}});
        expect(item.union).toEqual({a: '455'});
    }
});

test('union string | number', () => {
    const s = t.schema({
        union: t.union(t.string, 'b', t.number, 5).default('b'),
    });

    {
        const item = plainToClass(s, {union: false});
        expect(item.union).toBe('b');
    }

    {
        const item = plainToClass(s, {union: 'a'});
        expect(item.union).toBe('a');
    }

    {
        const item = plainToClass(s, {union: 'asdasd'});
        expect(item.union).toBe('asdasd');
    }

    {
        const item = plainToClass(s, {union: 5});
        expect(item.union).toBe(5);
    }

    {
        const item = plainToClass(s, {union: 88});
        expect(item.union).toBe(88);
    }
});

test('union string | date', () => {
    const s = t.schema({
        union: t.union(t.string, t.date),
    });

    {
        const item = plainToClass(s, {union: 'foo'});
        expect(item.union).toBe('foo');
    }

    {
        const item = plainToClass(s, {union: '2012-08-13T22:57:24.716Z'});
        expect(item.union).toBeInstanceOf(Date);
    }
});