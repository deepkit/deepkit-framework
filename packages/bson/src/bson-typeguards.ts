/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { isValidEnumValue } from '@deepkit/core';
import { PropertySchema, typedArrayNamesMap, Types, UnionGuardsTypes } from '@deepkit/type';
import { BaseParser, findValueInObject } from './bson-parser';
import { BSONType } from './utils';

export type BSONTypeGuard = (elementType: BSONType, parser: BaseParser) => boolean;
export type BSONTypeGuardFactory = (property: PropertySchema) => BSONTypeGuard;

export const bsonTypeGuards = new Map<UnionGuardsTypes, BSONTypeGuardFactory>();

export function registerBSONTypeGuard(type: UnionGuardsTypes, factory: BSONTypeGuardFactory) {
    bsonTypeGuards.set(type, factory);
}

registerBSONTypeGuard('class', (property: PropertySchema) => {
    const schema = property.getResolvedClassSchema();
    if (schema.discriminant) {
        const discriminant = schema.getProperty(schema.discriminant);
        const discriminantValue = discriminant.type === 'literal' ? discriminant.literalValue :
            discriminant.defaultValue ? discriminant.defaultValue() : undefined;

        if (discriminantValue === undefined) {
            throw new Error(`Discriminant ${schema.getClassPropertyName(discriminant.name)} has no default value.`);
        }

        const checker = (elementType: BSONType, name: string) => {
            return name === discriminant.name && (elementType !== BSONType.OBJECT);
        }

        return (elementType: BSONType, parser: BaseParser) => {
            if (elementType !== BSONType.OBJECT) return false;
            const v = findValueInObject(parser, checker);
            return v === discriminantValue;
        };
    }

    //we need to figure out what could be the discriminant
    for (const property of schema.getClassProperties().values()) {
        if (property.type !== 'literal') continue;

        const checker = (elementType: BSONType, name: string) => {
            return name === property.name && (elementType !== BSONType.OBJECT);
        }

        return (elementType: BSONType, parser: BaseParser) => {
            if (elementType !== BSONType.OBJECT) return false;
            const v = findValueInObject(parser, checker);
            return v === property.literalValue;
        };
    }

    throw new Error(`Type of property ${property.name} (${property.toString()}, ${schema.getClassName()}) has no discriminant or literal set. Could not discriminate the value.`);
});

registerBSONTypeGuard('string', (property: PropertySchema) => {
    return (elementType: BSONType, parser: BaseParser) => {
        return elementType === BSONType.STRING;
    };
});

registerBSONTypeGuard('enum', (property: PropertySchema) => {
    return (elementType: BSONType, parser: BaseParser) => {
        const validType = elementType === BSONType.STRING || elementType === BSONType.NUMBER;
        if (validType) {
            const v = parser.peek(elementType, property);
            return undefined !== v && !isValidEnumValue(property.resolveClassType, v, property.allowLabelsAsValue);
        }
        return false;
    };
});

registerBSONTypeGuard('objectId', (property: PropertySchema) => {
    return (elementType: BSONType, parser: BaseParser) => {
        return elementType === BSONType.OID;
    };
});

registerBSONTypeGuard('uuid', (property: PropertySchema) => {
    return (elementType: BSONType, parser: BaseParser) => {
        return elementType === BSONType.BINARY;
    };
});

registerBSONTypeGuard('arrayBuffer', (property: PropertySchema) => {
    return (elementType: BSONType, parser: BaseParser) => {
        return elementType === BSONType.BINARY;
    };
});

function typedArrayGuard(property: PropertySchema) {
    return (elementType: BSONType, parser: BaseParser) => {
        return elementType === BSONType.BINARY;
    };
}
for (const name of typedArrayNamesMap.keys()) {
    registerBSONTypeGuard(name, typedArrayGuard);
}

registerBSONTypeGuard('date', (property: PropertySchema) => {
    return (elementType: BSONType, parser: BaseParser) => {
        return elementType === BSONType.DATE;
    };
});

registerBSONTypeGuard('any', (property: PropertySchema) => {
    return (elementType: BSONType, parser: BaseParser) => {
        return true;
    };
});

registerBSONTypeGuard('union', (property: PropertySchema) => {
    throw new Error('Union typechecking not implemented. Nested unions thus not supported yet.');
});

registerBSONTypeGuard('array', (property: PropertySchema) => {
    return (elementType: BSONType, parser: BaseParser) => {
        return elementType === BSONType.ARRAY;
    };
});

registerBSONTypeGuard('map', (property: PropertySchema) => {
    return (elementType: BSONType, parser: BaseParser) => {
        return elementType === BSONType.OBJECT;
    };
});

registerBSONTypeGuard('patch', (property: PropertySchema) => {
    return (elementType: BSONType, parser: BaseParser) => {
        return elementType === BSONType.OBJECT;
    };
});

registerBSONTypeGuard('partial', (property: PropertySchema) => {
    return (elementType: BSONType, parser: BaseParser) => {
        return elementType === BSONType.OBJECT;
    };
});

registerBSONTypeGuard('number', (property: PropertySchema) => {
    return (elementType: BSONType, parser: BaseParser) => {
        return elementType === BSONType.NUMBER || elementType === BSONType.INT || elementType === BSONType.LONG;
    };
});

registerBSONTypeGuard('boolean', (property: PropertySchema) => {
    return (elementType: BSONType, parser: BaseParser) => {
        return elementType === BSONType.BOOLEAN;
    };
});

registerBSONTypeGuard('literal', (property: PropertySchema) => {
    return (elementType: BSONType, parser: BaseParser) => {
        const v = parser.peek(elementType);
        return v === property.literalValue;
    };
});
