import 'reflect-metadata';
import { expect, test } from '@jest/globals';
import { entity, t } from '../src/decorators';
import { getClassSchema } from '../src/model';
import { deserializeSchemas, serializeSchemas } from '../src/schema-serializer';

test('serialize types', async () => {
    class Meta {
        @t.required config!: string;
    }

    @entity.name('user')
    class User {
        @t.primary.autoIncrement.required id!: number;
        @t.required config!: Meta;
    }

    const serializedSchema = serializeSchemas([getClassSchema(User)]);

    expect(serializedSchema.length).toBe(2);
    expect(serializedSchema[0].name).toBeUndefined();
    expect(serializedSchema[0].embeddedName).toBe('embedded1');
    expect(serializedSchema[0].className).toBe('Meta');

    expect(serializedSchema[1].name).toBe('user');
    expect(serializedSchema[1].className).toBe('User');
    expect(serializedSchema[1].embeddedName).toBeUndefined();
    
    expect(serializedSchema[1].properties[0].name).toBe('id');
    expect(serializedSchema[1].properties[0].type).toBe('number');
    expect(serializedSchema[1].properties[0].isId).toBe(true);
    expect(serializedSchema[1].properties[0].autoIncrement).toBe(true);

    expect(serializedSchema[1].properties[1].name).toBe('config');
    expect(serializedSchema[1].properties[1].type).toBe('class');
    expect(serializedSchema[1].properties[1].classType).toBe('embedded1');
    expect(serializedSchema[1].properties[1].isId).toBeUndefined();
    expect(serializedSchema[1].properties[1].autoIncrement).toBeUndefined()

    const schemas = deserializeSchemas(serializedSchema, 'prefix');
    expect(schemas.length).toBe(2);
    expect(schemas[0]).not.toBe(getClassSchema(Meta));
    expect(schemas[0].name).toBeUndefined();
    expect(schemas[0].getClassName()).toBe('Meta');
    expect(schemas[0].hasProperty('config')).toBe(true);

    expect(schemas[1].name).toBe('user');
    expect(schemas[1].getClassName()).toBe('User');
    expect(schemas[1].getProperty('config').getResolvedClassSchema()).toBe(schemas[0]);
});