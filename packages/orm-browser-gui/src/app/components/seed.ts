import { EntityPropertySeed, FakerTypes, findFaker } from '@deepkit/orm-browser-api';
import { isReferenceType, ReflectionClass, ReflectionKind, Type } from '@deepkit/type';

export function autoTypes(fakerTypes: FakerTypes, entity: ReflectionClass<any>, properties: { [name: string]: EntityPropertySeed }, visited: Set<ReflectionClass<any>> = new Set()) {
    const autoProperty = (type: Type, propertyName: string, seed: EntityPropertySeed) => {
        if (type.kind === ReflectionKind.array) {
            autoProperty(type.type, propertyName, seed.getArray().seed);
            // } else if (type.isMap) {
            //     autoProperty(type.getSubType(), seed.getMap().seed);
        } else if ((type.kind === ReflectionKind.class || type.kind === ReflectionKind.objectLiteral) && type.types.length && !isReferenceType(type)) {
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
        } else if (!isReferenceType(type)) {
            seed.faker = findFaker(fakerTypes, propertyName, type);
            seed.fake = !!seed.faker;
            console.log('faker', propertyName, seed.faker);
        }
    };

    for (const [propName, seed] of Object.entries(properties)) {
        autoProperty(entity.getProperty(propName).type, entity.getProperty(propName).name, seed);
    }
}
