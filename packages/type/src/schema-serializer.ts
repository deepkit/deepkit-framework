import { ClassType } from "@deepkit/core";
import { t } from "./decorators";
import { ClassSchema, createClassSchema, getGlobalStore, PropertySchema, PropertySchemaSerialized } from "./model";
import { propertyDefinition } from "./model-schema";


export interface SerializedSchema {
    name?: string;
    embeddedName?: string;
    className: string;
    collectionName?: string;
    properties: PropertySchemaSerialized[];
}

export const serializedSchemaDefinition: ClassSchema<SerializedSchema> = t.schema({
    name: t.string.optional,
    embeddedName: t.string.optional,
    className: t.string,
    collectionName: t.string.optional,
    properties: t.array(propertyDefinition),
});

export function deserializeSchemas(schemas: SerializedSchema[], registryPrefix: string): ClassSchema[] {
    const result: ClassSchema[] = [];

    function fixRelation(property: PropertySchemaSerialized) {
        if (property.type === 'class') {
            if (!property.classType) {
                console.log('Property has invalid classType value', property);
            }
            property.classType = registryPrefix + property.classType;
        }

        if (property.templateArgs) for (const p of Object.values(property.templateArgs)) fixRelation(p);
    }

    const entities = getGlobalStore().RegisteredEntities;

    for (const entity of schemas) {
        for (const property of Object.values(entity.properties)) fixRelation(property);
    }

    for (const entity of schemas) {
        const schema = createClassSchema();
        Object.defineProperty(schema.classType, 'name', { value: entity.className });
        schema.name = entity.name || entity.embeddedName;
        schema.collectionName = entity.collectionName;
        result.push(schema);
        entities[registryPrefix + (entity.embeddedName || entity.name)] = schema;
    }

    for (let i = 0; i < result.length; i++) {
        for (const property of Object.values(schemas[i].properties)) {
            result[i].registerProperty(PropertySchema.fromJSON(property));
        }
    }

    return result;
}

export function serializeSchemas(schemas: ClassSchema[]): SerializedSchema[] {
    const result: SerializedSchema[] = [];
    const embeddedName = new Map<ClassType, string>();
    let nameId: number = 0;

    function fixProperty(property: PropertySchema, json: PropertySchemaSerialized) {
        if (json.type === 'class') {
            if (!json.classType) {
                let name = embeddedName.get(property.getResolvedClassType());
                if (!name) {
                    //this embedded is not known yet, we register and assign a random number
                    // embedded.set(property.getResolvedClassType(), property.getResolvedClassSchema());
                    name = '@:embedded/' + (++nameId);
                    embeddedName.set(property.getResolvedClassType(), name);
                    registerClassSchema(property.getResolvedClassSchema(), name);
                }
                json.classType = name;
            }
        }

        if (json.templateArgs) {
            for (let i = 0; i < property.templateArgs.length; i++) {
                fixProperty(property.templateArgs[i], json.templateArgs[i]);
            }
        }
    }

    function registerClassSchema(schema: ClassSchema, embeddedName?: string) {
        const properties = [...schema.getClassProperties().values()].map(v => serializeProperty(v));

        const serializedSchema: SerializedSchema = {
            name: schema.name,
            embeddedName,
            className: schema.getClassName(),
            collectionName: schema.collectionName,
            properties,
        };

        result.push(serializedSchema);
    }

    function serializeProperty(property: PropertySchema): PropertySchemaSerialized {
        const json = property.toJSON();

        fixProperty(property, json);

        if (json.templateArgs) {
            for (let i = 0; i < property.templateArgs.length; i++) {
                fixProperty(property.templateArgs[i], json.templateArgs[i]);
            }
        }

        return json;
    }

    for (const schema of schemas) {
        registerClassSchema(schema);
    }

    return result;
}
