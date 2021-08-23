import { t } from './decorators';
import { ClassSchema, createClassSchema, getClassSchema, PropertySchema, PropertySchemaSerialized, resolveClassTypeOrForward } from './model';
import { propertyDefinition } from './model-schema';


export interface SerializedSchema {
    name?: string;
    serializedName: string;
    className: string;
    collectionName?: string;
    properties: PropertySchemaSerialized[];
}

export const serializedSchemaDefinition: ClassSchema<SerializedSchema> = t.schema({
    name: t.string.optional,
    serializedName: t.string,
    className: t.string,
    collectionName: t.string.optional,
    properties: t.array(propertyDefinition),
});

export function deserializeSchemas(schemas: SerializedSchema[]): ClassSchema[] {
    if (!schemas.length) return [];

    const result: ClassSchema[] = [];

    //we do not add those classSchemas to the global entity registry
    const registry: { [name: string]: ClassSchema } = {};

    for (const entity of schemas) {
        const schema = createClassSchema();
        Object.defineProperty(schema.classType, 'name', { value: entity.className });
        schema.name = entity.name || entity.serializedName;
        schema.collectionName = entity.collectionName;
        result.push(schema);
        registry[entity.serializedName] = schema;
    }

    for (let i = 0; i < result.length; i++) {
        for (const property of Object.values(schemas[i].properties)) {
            result[i].registerProperty(PropertySchema.fromJSON(property, undefined, true, registry));
        }
    }

    return result;
}

class SchemaSerializer {
    protected serializedNames = new Map<ClassSchema, string>();
    protected nameId: number = 0;

    fixProperty(result: SerializedSchema[], property: PropertySchema, json: PropertySchemaSerialized) {
        if (json.type === 'class') {
            //for all class types, we do not store the actual used name via @entity.name() because
            //it could clash with entities already registered. So we generate a new name
            const isSerialized = this.isSerialized(property.getResolvedClassSchema());
            json.classType = this.getSerializedNameFromSchema(property.getResolvedClassSchema());
            if (!isSerialized) this.registerClassSchema(result, property.getResolvedClassSchema());
        }

        if (property.backReference && property.backReference.via && json.backReference && json.backReference.via) {
            const foreignSchema = getClassSchema(resolveClassTypeOrForward(property.backReference.via));
            const isSerialized = this.isSerialized(foreignSchema);
            json.backReference.via = this.getSerializedNameFromSchema(foreignSchema);
            if (!isSerialized) this.registerClassSchema(result, foreignSchema);
        }

        if (json.templateArgs) {
            for (let i = 0; i < property.templateArgs.length; i++) {
                this.fixProperty(result, property.templateArgs[i], json.templateArgs[i]);
            }
        }
    }

    protected isSerialized(schema: ClassSchema): boolean {
        return this.serializedNames.has(schema);
    }

    protected getSerializedNameFromSchema(schema: ClassSchema) {
        let name = this.serializedNames.get(schema);
        //if the references class has no serialized name yet, we create one and add it to the result
        if (!name) {
            //this embedded is not known yet, we register and assign a random number
            // embedded.set(property.getResolvedClassType(), property.getResolvedClassSchema());
            name = '@:serialized/' + (++this.nameId);
            this.serializedNames.set(schema, name);
        }

        return name;
    }

    registerClassSchema(result: SerializedSchema[], schema: ClassSchema) {
        const properties = [...schema.getProperties()].map(v => this.serializeProperty(result, v));

        const serializedSchema: SerializedSchema = {
            name: schema.name,
            serializedName: this.getSerializedNameFromSchema(schema),
            className: schema.getClassName(),
            collectionName: schema.collectionName,
            properties,
        };

        result.push(serializedSchema);
    }

    serializeProperty(result: SerializedSchema[], property: PropertySchema): PropertySchemaSerialized {
        const json = property.toJSON();

        this.fixProperty(result, property, json);

        if (json.templateArgs) {
            for (let i = 0; i < property.templateArgs.length; i++) {
                this.fixProperty(result, property.templateArgs[i], json.templateArgs[i]);
            }
        }

        return json;
    }

    serialize(schemas: ClassSchema[]): SerializedSchema[] {
        const result: SerializedSchema[] = [];

        for (const schema of schemas) {
            this.registerClassSchema(result, schema);
        }

        return result;
    }
}

export function serializeSchemas(schemas: ClassSchema[]): SerializedSchema[] {
    return new SchemaSerializer().serialize(schemas);
}
