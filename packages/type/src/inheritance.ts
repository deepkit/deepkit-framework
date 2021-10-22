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
//
// export function findCommonLiteral(classSchemas: ClassSchema[]): string | undefined {
//     const candidates: { [name: string]: { found: number, values: any[], schemas: ClassSchema[] } } = {};
//
//     for (const schema of classSchemas) {
//         for (const property of schema.getProperties()) {
//             if (property.type !== 'literal') continue;
//
//             if (candidates[property.name]) {
//                 let candidate = candidates[property.name];
//                 candidate.found++;
//                 if (candidate.values.includes(property.literalValue)) {
//                     const usedBy = candidate.schemas[candidate.values.indexOf(property.literalValue)];
//                     if (usedBy !== schema) {
//                         throw new Error(`${schema.getClassName()} has a literal on ${property.name} that is already used by ${usedBy.getClassName()}.`);
//                     }
//                 }
//                 candidate.values.push(property.literalValue);
//                 candidate.schemas.push(schema);
//             } else {
//                 candidates[property.name] = { found: 1, values: [property.literalValue], schemas: [schema] };
//             }
//         }
//     }
//
//     //check which candidate has the right amount of usages
//     for (const [name, info] of Object.entries(candidates)) {
//         if (info.found === classSchemas.length) return name;
//     }
//
//     return;
// }
