import {
    getClassSchema,
    getCollectionName,
    getDatabaseName,
    getEntityName,
    getIdField,
    typedArrayNamesMap
} from "@marcj/marshal";
import {ColumnType, EntitySchema, EntitySchemaColumnOptions, EntitySchemaIndexOptions} from "typeorm";
import {ClassType, each, getEnumValues} from "@marcj/estdlib";

function propertyToColumnOptions<T>(classType: ClassType<T>, propertyName: string): EntitySchemaColumnOptions {
    const schema = getClassSchema(classType);
    const property = schema.getProperty(propertyName);

    const nullable = property.isOptional;
    let type: ColumnType = 'json';
    let enumValues: any[] | undefined;

    if (!property.isArray && !property.isMap) {
        if (property.type === 'string') {
            type = 'string';
        }

        if (property.type === 'number') {
            type = 'number';
        }

        if (property.type === 'arrayBuffer' || typedArrayNamesMap.has(property.type)) {
            type = 'binary';
        }

        if (property.type === 'date') {
            type = 'date';
        }

        if (property.type === 'boolean') {
            type = 'boolean';
        }

        if (property.type === 'uuid') {
            type = 'uuid';
        }

        if (property.type === 'objectId') {
            type = 'string';
        }

        if (property.type === 'enum') {
            type = 'enum';
            enumValues = getEnumValues(property.resolveClassType);
        }
    }

    return {
        name: propertyName,
        type: type,
        objectId: property.type === 'objectId',
        enum: enumValues,
        primary: getIdField(classType) === propertyName,
        nullable: nullable,
    }
}

export function getTypeOrmEntity<T>(classType: ClassType<T>): EntitySchema<T> {
    let name = getCollectionName(classType) || getEntityName(classType);
    const schema = getClassSchema(classType);

    const indices: EntitySchemaIndexOptions[] = [];
    for (const index of schema.indices) {
        indices.push({
            name: index.name,
            columns: index.fields,
            ...index.options,
        });
    }

    const columns: {
        [P in keyof T]?: EntitySchemaColumnOptions;
    } = {};

    for (const property of schema.getClassProperties().values()) {
        if (property.isParentReference) {
            //we do not export parent references, as this would lead to an circular reference
            continue;
        }

        if (property.exclude && property.exclude !== 'plain') continue;

        if (property.isReference) continue;

        columns[property.name] = propertyToColumnOptions(classType, property.name);
    }

    return new EntitySchema({
        name: name,
        database: getDatabaseName(classType),
        columns: columns,
        indices: indices
    });
}
