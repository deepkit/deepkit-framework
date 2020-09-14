import 'jest';
import 'reflect-metadata';
import {plainSerializer, t, validate} from '../index';

test('union ClassType', () => {
    class RegularUser {
        @t.literal('regular')
        type!: 'regular';

        @t.string
        name!: string;
    }

    class AdminUser {
        @t.literal('admin')
        type!: 'admin';

        @t.string
        superAdminName!: string;
    }

    const s = t.schema({
        union: t.union(RegularUser, AdminUser),
    });

    {
        const item = plainSerializer.for(s).deserialize({union: {type: 'regular'}});
        expect(item.union.type).toBe('regular');
        expect(item.union).toBeInstanceOf(RegularUser);
    }

    {
        const item = plainSerializer.for(s).deserialize({union: {type: 'admin'}});
        expect(item.union.type).toBe('admin');
        expect(item.union).toBeInstanceOf(AdminUser);
    }

    expect(s.getProperty('union').hasDefaultValue).toBe(false);
    expect(s.getProperty('union').hasManualDefaultValue()).toBe(false);

    expect(validate(s, {union: {}})).toEqual([{code: 'invalid_union', message: 'No compatible type for union found', path: 'union',}]);
    expect(validate(s, {union: {type: 'invalid'}})).toEqual([{code: 'invalid_union', message: 'No compatible type for union found', path: 'union',}]);
    expect(validate(s, {union: {type: 'invalid'}})).toEqual([{code: 'invalid_union', message: 'No compatible type for union found', path: 'union',}]);
    expect(validate(s, {union: {type: 'invalid'}})).toEqual([{code: 'invalid_union', message: 'No compatible type for union found', path: 'union',}]);
    expect(validate(s, {union: {type: 'admin'}})).toEqual([{code: 'required', message: 'Required value is undefined', path: 'union.superAdminName',}]);
    expect(validate(s, {union: {type: 'admin', name: 'asd'}})).toEqual([{code: 'required', message: 'Required value is undefined', path: 'union.superAdminName',}]);
    expect(validate(s, {union: {type: 'admin', superAdminName: 'yes'}})).toEqual([]);
    expect(validate(s, {union: {type: 'regular', superAdminName: 'asd'}})).toEqual([{code: 'required', message: 'Required value is undefined', path: 'union.name',}]);
    expect(validate(s, {union: {type: 'regular', name: 'asd'}})).toEqual([]);
    expect(validate(s, {union: {type: 'regular'}})).toEqual([{code: 'required', message: 'Required value is undefined', path: 'union.name',}]);
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
        const item = plainSerializer.for(s).deserialize({union: {type: 'regular'}});
        expect(item.union.type).toBe('regular');
    }

    {
        const item = plainSerializer.for(s).deserialize({union: {type: 'admin'}});
        expect(item.union.type).toBe('admin');
    }

    expect(validate(s, {union: {}})).toEqual([{code: 'invalid_union', message: 'No compatible type for union found', path: 'union',}]);
    expect(validate(s, {union: {type: 'regular'}})).toEqual([]);
    expect(validate(s, {union: {type: 'admin'}})).toEqual([]);
    expect(validate(s, {union: {type: 'invalid'}})).toEqual([{code: 'invalid_union', message: 'No compatible type for union found', path: 'union',}]);
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
        const item = plainSerializer.for(s).deserialize({union: {type: 'regular'}});
        expect(item.union.type).toBe('regular');
    }

    {
        const item = plainSerializer.for(s).deserialize({union: {type: 'admin'}});
        expect(item.union.type).toBe('admin');
    }

    expect(validate(s, {union: {}})).toEqual([{code: 'invalid_union', message: 'No compatible type for union found', path: 'union',}]);
    expect(validate(s, {union: {type: 'regular'}})).toEqual([]);
    expect(validate(s, {union: {type: 'admin'}})).toEqual([]);
    expect(validate(s, {union: {type: 'invalid'}})).toEqual([{code: 'invalid_union', message: 'No compatible type for union found', path: 'union',}]);
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

    expect(validate(s, {union: {}})).toEqual([{code: 'invalid_union', message: 'No compatible type for union found', path: 'union',}]);
    expect(validate(s, {union: {type: 'regular'}})).toEqual([]);
    expect(validate(s, {union: {type: 'admin'}})).toEqual([]);
    expect(validate(s, {union: {type: 'invalid'}})).toEqual([{code: 'invalid_union', message: 'No compatible type for union found', path: 'union',}]);
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
        const item = plainSerializer.for(s).deserialize({union: 'a'});
        expect(item.union).toBe('a');
    }

    {
        const item = plainSerializer.for(s).deserialize({union: 'b'});
        expect(item.union).toBe('b');
    }

    {
        const item = plainSerializer.for(s).deserialize({union: 'c'});
        expect(item.union).toBe('c');
    }

    {
        const item = plainSerializer.for(s).deserialize({union: '0'});
        expect(item.union).toBe('a');
    }

    expect(validate(s, {})).toEqual([]); //because of default
    expect(validate(s, {union: 'd'})).toEqual([{code: 'invalid_union', message: 'No compatible type for union found', path: 'union',}]);
    expect(validate(s, {union: 'a'})).toEqual([]);
    expect(validate(s, {union: 'b'})).toEqual([]);
    expect(validate(s, {union: 'c'})).toEqual([]);
});

test('union literal and string', () => {
    const s = t.schema({
        union: t.union('a', t.string, 'b').default('a'),
    });

    {
        const item = plainSerializer.for(s).deserialize({union: 'a'});
        expect(item.union).toBe('a');
    }

    {
        const item = plainSerializer.for(s).deserialize({union: 'asdasd'});
        expect(item.union).toBe('asdasd');
    }

    {
        const item = plainSerializer.for(s).deserialize({union: '0'});
        expect(item.union).toBe('0');
    }

    expect(validate(s, {union: 'a'})).toEqual([]);
    expect(validate(s, {union: 'b'})).toEqual([]);
    expect(validate(s, {union: 'asdasd'})).toEqual([]); //t.string valid
    expect(validate(s, {union: false})).toEqual([{code: 'invalid_union', message: 'No compatible type for union found', path: 'union',}]);
    expect(validate(s, {union: 1233})).toEqual([{code: 'invalid_union', message: 'No compatible type for union found', path: 'union',}]);
    expect(validate(s, {union: {}})).toEqual([{code: 'invalid_union', message: 'No compatible type for union found', path: 'union',}]);
});

test('union string | string[]', () => {
    const s = t.schema({
        union: t.union(t.string, t.array(t.string)),
    });

    {
        const item = plainSerializer.for(s).deserialize({union: '123'});
        expect(item.union).toBe('123');
    }

    {
        const item = plainSerializer.for(s).deserialize({union: ['455']});
        expect(item.union).toEqual(['455']);
    }

    expect(validate(s, {union: {}})).toEqual([{code: 'invalid_union', message: 'No compatible type for union found', path: 'union',}]);
    expect(validate(s, {union: false})).toEqual([{code: 'invalid_union', message: 'No compatible type for union found', path: 'union',}]);
    expect(validate(s, {union: [false]})).toEqual([{code: 'invalid_string', message: 'No string given', path: 'union.0',}]);
    expect(validate(s, {union: []})).toEqual([]);
    expect(validate(s, {union: ['valid']})).toEqual([]);
    expect(validate(s, {union: 'valid'})).toEqual([]);
});

test('union string | string[][]', () => {
    const s = t.schema({
        union: t.union(t.string, t.array(t.array(t.string))),
    });

    // jitPlainToClass(s);
    // console.log(getJitFunctionXToClass(s, 'plain').toString());

    {
        const item = plainSerializer.for(s).deserialize({union: '123'});
        expect(item.union).toBe('123');
    }

    {
        const item = plainSerializer.for(s).deserialize({union: [['455'], ['4']]});
        expect(item.union).toEqual([['455'], ['4']]);
    }

    {
        const item = plainSerializer.for(s).deserialize({union: [123]});
        expect(item.union).toEqual([[]]);
    }

    {
        const item = plainSerializer.for(s).deserialize({union: ['455']});
        expect(item.union).toEqual([[]]);
    }

    expect(validate(s, {union: {}})).toEqual([{code: 'invalid_union', message: 'No compatible type for union found', path: 'union',}]);
    expect(validate(s, {union: false})).toEqual([{code: 'invalid_union', message: 'No compatible type for union found', path: 'union',}]);
    expect(validate(s, {union: [false]})).toEqual([{code: 'invalid_type', message: 'Type is not an array', path: 'union.0',}]);
    expect(validate(s, {union: [[false]]})).toEqual([{code: 'invalid_string', message: 'No string given', path: 'union.0.0',}]);
    expect(validate(s, {union: []})).toEqual([]);
    expect(validate(s, {union: [[]]})).toEqual([]);
    expect(validate(s, {union: [['valid']]})).toEqual([]);
    expect(validate(s, {union: 'valid'})).toEqual([]);
});

test('union string | map', () => {
    const s = t.schema({
        union: t.union(t.string, t.map(t.string)),
    });

    {
        const item = plainSerializer.for(s).deserialize({union: '123'});
        expect(item.union).toBe('123');
    }

    {
        const item = plainSerializer.for(s).deserialize({union: {a: '455'}});
        expect(item.union).toEqual({a: '455'});
    }

    expect(validate(s, {union: []})).toEqual([{code: 'invalid_union', message: 'No compatible type for union found', path: 'union',}]);
    expect(validate(s, {union: false})).toEqual([{code: 'invalid_union', message: 'No compatible type for union found', path: 'union',}]);
    expect(validate(s, {union: {a: false}})).toEqual([{code: 'invalid_string', message: 'No string given', path: 'union.a',}]);
    expect(validate(s, {union: {a: 'valid'}})).toEqual([]);
    expect(validate(s, {union: 'valid'})).toEqual([]);
});

test('union string | number', () => {
    const s = t.schema({
        union: t.union(t.string, 'b', t.number, 5).default('b'),
    });

    {
        const item = plainSerializer.for(s).deserialize({union: false});
        expect(item.union).toBe('b');
    }

    {
        const item = plainSerializer.for(s).deserialize({union: 'a'});
        expect(item.union).toBe('a');
    }

    {
        const item = plainSerializer.for(s).deserialize({union: 'asdasd'});
        expect(item.union).toBe('asdasd');
    }

    {
        const item = plainSerializer.for(s).deserialize({union: 5});
        expect(item.union).toBe(5);
    }

    {
        const item = plainSerializer.for(s).deserialize({union: 88});
        expect(item.union).toBe(88);
    }

    expect(validate(s, {union: {}})).toEqual([{code: 'invalid_union', message: 'No compatible type for union found', path: 'union',}]);
    expect(validate(s, {union: false})).toEqual([{code: 'invalid_union', message: 'No compatible type for union found', path: 'union',}]);
    expect(validate(s, {union: 'valid'})).toEqual([]);
    expect(validate(s, {union: 'b'})).toEqual([]);
    expect(validate(s, {union: 'c'})).toEqual([]);
    expect(validate(s, {union: 123})).toEqual([]);
    expect(validate(s, {union: 5})).toEqual([]);
});

test('union string | date', () => {
    const s = t.schema({
        union: t.union(t.string, t.date),
    });

    {
        const item = plainSerializer.for(s).deserialize({union: 'foo'});
        expect(item.union).toBe('foo');
    }

    {
        const item = plainSerializer.for(s).deserialize({union: '2012-08-13T22:57:24.716Z'});
        expect(item.union).toBeInstanceOf(Date);
    }

    expect(validate(s, {union: {}})).toEqual([{code: 'invalid_union', message: 'No compatible type for union found', path: 'union',}]);
    expect(validate(s, {union: false})).toEqual([{code: 'invalid_union', message: 'No compatible type for union found', path: 'union',}]);
    expect(validate(s, {union: 'sad'})).toEqual([]);
    expect(validate(s, {union: '2012-08-13T22:57:24.716Z'})).toEqual([]);
});