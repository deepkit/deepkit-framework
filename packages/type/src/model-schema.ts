/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { t } from './decorators';
import { FieldDecoratorResult } from './field-decorator';
import { Types } from './types';
import { ClassSchema, PropertySchemaSerialized } from './model';

export const propertyDefinition: ClassSchema<PropertySchemaSerialized> = t.schema({
    id: t.number,
    name: t.string,
    description: t.string.optional,
    type: t.string as FieldDecoratorResult<Types>,
    literalValue: t.union(t.string, t.number, t.boolean).optional,
    isDecorated: t.literal(true).optional,
    isParentReference: t.literal(true).optional,
    isReference: t.literal(true).optional,
    isOptional: t.literal(true).optional,
    isId: t.literal(true).optional,
    autoIncrement: t.literal(true).optional,
    typeSet: t.literal(true).optional,
    isDiscriminant: t.literal(true).optional,
    allowLabelsAsValue: t.literal(true).optional,
    classType: t.string.optional,
    defaultValue: t.any.optional,
    classTypeName: t.string.optional,
    noValidation: t.literal(true).optional,
    methodName: t.string.optional,
    enum: t.map(t.any).optional,
    data: t.map(t.any).optional,
    groupNames: t.array(t.string).optional,
    jsonType: t.union(t.number, t.type(() => propertyDefinition)).optional,
    hasDefaultValue: t.literal(true).optional,
    backReference: t.type({mappedBy: t.string.optional, via: t.string.optional},).optional,
    templateArgs: t.array(t.union(t.number, t.type((): any => propertyDefinition))).optional,
    classTypeProperties: t.array(t.union(t.number, (): any => propertyDefinition)).optional,
});
