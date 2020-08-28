import 'jest-extended';
import 'reflect-metadata';
import {t} from '../src/decorators';
import {classToPlain, plainToClass} from '../src/mapper';
import {getClassToXFunction} from '../src/jit';

test('test invalidation plainToClass', () => {
    const schema = t.schema({
        username: t.string
    });

    const startBuildId = schema.buildId;

    expect(plainToClass(schema, {username: 'peter', foo: 'bar'})).toEqual({username: 'peter'});

    schema.addProperty('foo', t.string);
    expect(schema.buildId).toBe(startBuildId + 1);

    expect(plainToClass(schema, {username: 'peter', foo: 'bar'})).toEqual({username: 'peter', foo: 'bar'});
});

test('test invalidation classToPlain', () => {
    const schema = t.schema({
        username: t.string
    });

    const startBuildId = schema.buildId;

    expect(getClassToXFunction(schema, 'plain')({username: 'peter', foo: 'bar'} as any)).toEqual({username: 'peter'});

    schema.addProperty('foo', t.string);
    expect(schema.buildId).toBe(startBuildId + 1);

    expect(getClassToXFunction(schema, 'plain')({username: 'peter', foo: 'bar'} as any)).toEqual({username: 'peter', foo: 'bar'});
});