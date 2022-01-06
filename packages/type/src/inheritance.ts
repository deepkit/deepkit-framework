/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

// import { ClassSchema, PropertySchema } from './model';
//
//
// export function findCommonDiscriminant(classSchemas: ClassSchema[]): string | undefined {
//     //check if all discriminators are correct
//     let discriminatorFound: { schema: ClassSchema, property: PropertySchema } | undefined;
//     for (const schema of classSchemas) {
//         if (discriminatorFound && !schema.discriminant) {
//             throw new Error(`${discriminatorFound.schema.getClassName()} has a discriminant on '${discriminatorFound.property.name}' but ${schema.getClassName()} has none.`);
//         }
//
//         if (discriminatorFound && schema.discriminant && schema.discriminant !== discriminatorFound.property.name) {
//             throw new Error(`${discriminatorFound.schema.getClassName()} has a discriminant on '${discriminatorFound.property.name}' but ${schema.getClassName()} has one on '${schema.discriminant}'.`);
//         }
//
//         if (!discriminatorFound && schema.discriminant) {
//             discriminatorFound = { schema: schema, property: schema.getProperty(schema.discriminant) };
//         }
//     }
//
//     return discriminatorFound ? discriminatorFound.property.name : undefined;
// }

import { ReflectionClass } from './reflection/reflection';
import { ReflectionKind } from './reflection/type';

export function findCommonLiteral(reflectionClasses: ReflectionClass<any>[]): string | undefined {
    const candidates: { [name: string]: { found: number, values: any[], schemas: ReflectionClass<any>[] } } = {};

    for (const schema of reflectionClasses) {
        console.log('schema', schema.getClassName(), schema.type.types);
        for (const property of schema.getProperties()) {
            console.log('property.type.kind', property.name, property.type.kind);
            if (property.type.kind !== ReflectionKind.literal) continue;

            if (candidates[property.name]) {
                let candidate = candidates[property.name];
                candidate.found++;
                if (candidate.values.includes(property.type.literal)) {
                    const usedBy = candidate.schemas[candidate.values.indexOf(property.type.literal)];
                    if (usedBy !== schema) {
                        throw new Error(`${schema.getClassName()} has a literal on ${property.name} that is already used by ${usedBy.getClassName()}.`);
                    }
                }
                candidate.values.push(property.type.literal);
                candidate.schemas.push(schema);
            } else {
                candidates[property.name] = { found: 1, values: [property.type.literal], schemas: [schema] };
            }
        }
    }

    console.log('candidates', candidates);
    //check which candidate has the right amount of usages
    for (const [name, info] of Object.entries(candidates)) {
        if (info.found === reflectionClasses.length) return name;
    }

    return;
}
