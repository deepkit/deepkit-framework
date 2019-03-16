import {
    getDatabaseName,
    getEntityName, getEntitySchema,
    getIdField,
    getParentReferenceClass,
    getRegisteredProperties,
    getResolvedReflection,
    isEnumAllowLabelsAsValue, isExcluded,
    isOptional
} from "@marcj/marshal";
import {ColumnType, EntitySchema, EntitySchemaColumnOptions, EntitySchemaIndexOptions} from "typeorm";
import {ClassType, getEnumValues, getEnumLabels} from "@marcj/estdlib";

function propertyToColumnOptions<T>(classType: ClassType<T>, propertyName: string): EntitySchemaColumnOptions {

    const reflection = getResolvedReflection(classType, propertyName);
    if (!reflection) {
        throw new Error(`No reflection found for ${getEntityName(classType)}::${propertyName}`)
    }

    const nullable = isOptional(classType, propertyName);
    let type: ColumnType = 'json';
    let enumValues: any[] | undefined;

    if (!reflection.array && !reflection.map) {
        if (reflection.type === 'string') {
            type = 'string';
        }

        if (reflection.type === 'number') {
            type = 'number';
        }

        if (reflection.type === 'binary') {
            type = 'binary';
        }

        if (reflection.type === 'date') {
            type = 'date';
        }

        if (reflection.type === 'boolean') {
            type = 'boolean';
        }

        if (reflection.type === 'uuid') {
            type = 'uuid';
        }

        if (reflection.type === 'objectId') {
            type = 'string';
        }

        if (reflection.type === 'enum') {
            type = 'enum';
            enumValues = getEnumValues(reflection.typeValue);
        }
    }

    return {
        name: propertyName,
        type: type,
        objectId: reflection.type === 'objectId',
        enum: enumValues,
        primary: getIdField(classType) === propertyName,
        nullable: nullable,
    }
}

export function getTypeOrmEntity<T>(classType: ClassType<T>): EntitySchema<T> {
    const name = getEntityName(classType);
    const schema = getEntitySchema(classType);

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

    for (const propertyName of getRegisteredProperties(classType)) {
        if (getParentReferenceClass(classType, propertyName)) {
            //we do not export parent references, as this would lead to an circular reference
            continue;
        }

        if (isExcluded(classType, propertyName, 'mongo')) {
            continue;
        }

        columns[propertyName] = propertyToColumnOptions(classType, propertyName);
    }

    return new EntitySchema({
        name: name,
        database: getDatabaseName(classType),
        columns: columns,
        indices: indices
    });
}
