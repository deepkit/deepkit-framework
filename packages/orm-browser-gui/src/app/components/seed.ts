import { ClassSchema, PropertySchema } from '@deepkit/type';
import { EntityPropertySeed, FakerTypes, findFaker } from '@deepkit/orm-browser-api';

export function autoTypes(fakerTypes: FakerTypes, entity: ClassSchema, properties: { [name: string]: EntityPropertySeed }, visited: Set<ClassSchema> = new Set()) {
    const autoProperty = (property: PropertySchema, seed: EntityPropertySeed) => {
        if (property.isArray) {
            autoProperty(property.getSubType(), seed.getArray().seed);
        } else if (property.isMap) {
            autoProperty(property.getSubType(), seed.getMap().seed);
        } else if (property.type === 'class' && !property.isReference) {
            // if (visited.has(property.getResolvedClassSchema())) return;
            // visited.add(property.getResolvedClassSchema());
            //
            // for (const prop of property.getResolvedClassSchema().getProperties()) {
            //     if (prop.backReference) continue;
            //     if (prop.isParentReference) continue;
            //
            //     seed.properties[prop.name] = new EntityPropertySeed(prop.name);
            //     autoProperty(prop, seed.properties[prop.name]);
            // }
        } else if (!property.isReference) {
            seed.faker = findFaker(fakerTypes, property);
            seed.fake = !!seed.faker;
        }
    };

    for (const [propName, seed] of Object.entries(properties)) {
        autoProperty(entity.getProperty(propName), seed);
    }
}
