import 'reflect-metadata';
import { expect, test } from '@jest/globals';
import { entity, t } from '../src/decorators';
import { getClassSchema, PropertySchema } from '../src/model';
import { deserializeSchemas, serializedSchemaDefinition, serializeSchemas } from '../src/schema-serializer';

test('serialize types', async () => {
    enum Status {
        pending,
        active,
        disabled,
    }

    class Meta {
        @t.required config!: string;
    }

    @entity.name('user')
    class User {
        @t.primary.autoIncrement.required id!: number;
        @t.required config!: Meta;
        @t.enum(Status) status!: Status;
    }

    const serializedSchema = serializeSchemas([getClassSchema(User)]);

    expect(serializedSchema.length).toBe(2);
    expect(serializedSchema[0].name).toBeUndefined();
    expect(serializedSchema[0].serializedName).toBe('@:serialized/1');
    expect(serializedSchema[0].className).toBe('Meta');

    expect(serializedSchema[1].name).toBe('user');
    expect(serializedSchema[1].className).toBe('User');
    expect(serializedSchema[1].serializedName).toBe('@:serialized/2');

    const properties = serializedSchema[1].properties;

    expect(properties[0].name).toBe('id');
    expect(properties[0].type).toBe('number');
    expect(properties[0].isId).toBe(true);
    expect(properties[0].autoIncrement).toBe(true);

    expect(properties[1].name).toBe('config');
    expect(properties[1].type).toBe('class');
    expect(properties[1].classType).toBe('@:serialized/1');
    expect(properties[1].isId).toBeUndefined();
    expect(properties[1].autoIncrement).toBeUndefined();

    expect(properties[2].name).toBe('status');
    expect(properties[2].type).toBe('enum');
    expect(properties[2].classType).toBeUndefined();
    expect(properties[2].classTypeProperties).toBeUndefined();
    expect(properties[2].enum).not.toBeUndefined();

    const schemas = deserializeSchemas(serializedSchema);
    expect(schemas.length).toBe(2);
    expect(schemas[0]).not.toBe(getClassSchema(Meta));
    expect(schemas[0].name).toBe('@:serialized/1');
    expect(schemas[0].getClassName()).toBe('Meta');
    expect(schemas[0].hasProperty('config')).toBe(true);

    expect(schemas[1].name).toBe('user');
    expect(schemas[1].getClassName()).toBe('User');
    expect(schemas[1].getProperty('config').getResolvedClassSchema()).toBe(schemas[0]);
    expect(schemas[1].hasProperty('status')).toBe(true);
    expect(schemas[1].getProperty('status').getResolvedClassType()).toEqual(Status);
});

test('dont serialise entity twice', () => {
    class Author {

    }

    class Book {
        constructor(@t author: Author) {
        }
    }

    expect(getClassSchema(Book).getProperty('author').getResolvedClassSchema() === getClassSchema(Author)).toBe(true);

    {
        const schemas = serializeSchemas([getClassSchema(Book), getClassSchema(Author)]);
        expect(schemas).toHaveLength(2);
    }

    {
        const schemas = serializeSchemas([getClassSchema(Author), getClassSchema(Book)]);
        expect(schemas).toHaveLength(2);
    }
});


test('serialise Promise', () => {

    class Controller {
        @t
        async action(): Promise<string> {
            return 'hello';
        }
    }

    const json = getClassSchema(Controller).getMethod('action').toJSON();
});

test('serialise nested PropertySchema', () => {
    {
        const property = new PropertySchema('v');
        property.templateArgs[0] = property;

        const json = property.toJSONNonReference();
        expect(json.templateArgs![0]).toBe(0);

        const propertyBack = PropertySchema.fromJSON(json);
        expect(propertyBack).toBeInstanceOf(PropertySchema);
        expect(propertyBack === propertyBack.templateArgs[0]).toBe(true);
    }
});

test('serialise SerializedSchema', () => {
    const propertySchema = serializedSchemaDefinition.getProperty('properties').getSubType();
    const json = propertySchema.toJSONNonReference();

    // console.log('json', ...json.classTypeProperties!);

    const back = PropertySchema.fromJSON(json);

    const templateArgsSubType = back.getResolvedClassSchema().getProperty('templateArgs').getSubType();
    const classTypePropertiesSubType = back.getResolvedClassSchema().getProperty('classTypeProperties').getSubType();

    expect(templateArgsSubType.templateArgs[1].type).toBe('class');
    expect(classTypePropertiesSubType.templateArgs[1].type).toBe('class');
});
