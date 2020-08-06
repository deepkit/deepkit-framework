import 'jest-extended';
import 'reflect-metadata';
import {getClassSchema, t} from '@super-hornet/marshal';
import {getNormalizedPrimaryKey} from '../index';

test('getNormalizedPrimaryKey', () => {
    class User {
        @t.primary id: string = '';
        @t name: string = 'Foo';
    }

    expect(getNormalizedPrimaryKey(getClassSchema(User), '123')).toEqual({id: '123'});
    expect(getNormalizedPrimaryKey(getClassSchema(User), {id: '124'})).toEqual({id: '124'});

    class User2 {
        @t.primary id: string = '';
        @t.primary id2: string = '';
        @t name: string = 'Foo';
    }

    expect(() => getNormalizedPrimaryKey(getClassSchema(User2), '123')).toThrow('Entity User2 has composite primary key');
    expect(getNormalizedPrimaryKey(getClassSchema(User2), {id: '124', id2: '444'})).toEqual({id: '124', id2: '444'});
});

test('asd', () => {

});
