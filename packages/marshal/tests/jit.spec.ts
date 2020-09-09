import 'jest-extended';
import 'reflect-metadata';
import {t} from '../src/decorators';
import {getClassToXFunction} from '../src/jit';
import {plainSerializer} from '../src/plain-serializer';

test('test invalidation plainToClass', () => {
    const schema = t.schema({
        username: t.string
    });

    const startBuildId = schema.buildId;

    expect(plainSerializer.for(schema).deserialize({username: 'peter', foo: 'bar'})).toEqual({username: 'peter'});

    schema.addProperty('foo', t.string);
    expect(schema.buildId).toBe(startBuildId + 1);

    expect(plainSerializer.for(schema).deserialize({username: 'peter', foo: 'bar'})).toEqual({username: 'peter', foo: 'bar'});
});

test('test invalidation classToPlain', () => {
    const schema = t.schema({
        username: t.string
    });

    const startBuildId = schema.buildId;

    expect(getClassToXFunction(schema, plainSerializer)({username: 'peter', foo: 'bar'} as any)).toEqual({username: 'peter'});

    schema.addProperty('foo', t.string);
    expect(schema.buildId).toBe(startBuildId + 1);

    expect(getClassToXFunction(schema, plainSerializer)({username: 'peter', foo: 'bar'} as any)).toEqual({username: 'peter', foo: 'bar'});
});