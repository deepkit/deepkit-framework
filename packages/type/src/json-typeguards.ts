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
import { PropertySchema } from './model';
import { typedArrayNamesMap, Types } from './types';
import { UnionGuardsTypes } from "./union";

export type JSONTypeGuard = (v: any) => boolean;
export type JSONTypeGuardFactory = (property: PropertySchema) => JSONTypeGuard;

export const jsonTypeGuards = new Map<UnionGuardsTypes, JSONTypeGuardFactory>();

export function registerJSONTypeGuard(type: UnionGuardsTypes, factory: JSONTypeGuardFactory) {
    jsonTypeGuards.set(type, factory);
}

registerJSONTypeGuard('class', (property: PropertySchema) => {
    const schema = property.getResolvedClassSchema();
    if (schema.discriminant) {
        const discriminant = schema.getProperty(schema.discriminant);
        const discriminantValue = discriminant.type === 'literal' ? discriminant.literalValue : discriminant.getDefaultValue();
        if (discriminantValue === undefined) {
            throw new Error(`Discriminant ${schema.getClassPropertyName(discriminant.name)} has no default value.`);
        }

        return (v: any) => {
            return v && v[discriminant.name] === discriminantValue;
        };
    }

    //we need to figure out what could be the discriminant
    for (const property of schema.getClassProperties().values()) {
        if (property.type !== 'literal') continue;

        return (v: any) => {
            return v && v[property.name] === property.literalValue;
        };
    }

    throw new Error(`Type of property ${property.name} (${property.toString()}) has no discriminant or literal set. Could not discriminate the value.`);
});

registerJSONTypeGuard('string', (property: PropertySchema) => {
    return (v: any) => {
        return 'string' === typeof v;
    };
});

registerJSONTypeGuard('enum', (property: PropertySchema) => {
    return (v: any) => {
        return undefined !== v && !isValidEnumValue(property.resolveClassType, v, property.allowLabelsAsValue);
    };
});

registerJSONTypeGuard('objectId', (property: PropertySchema) => {
    return (v: any) => {
        return 'string' === typeof v && v.length === 24;
    };
});

registerJSONTypeGuard('uuid', (property: PropertySchema) => {
    return (v: any) => {
        return 'string' === typeof v && v.length === 36 && v[23] === '-' && v[19] === '-' && v[13] === '-' && v[8] === '-';
    };
});

registerJSONTypeGuard('arrayBuffer', (property: PropertySchema) => {
    return (v: any) => {
        return v instanceof ArrayBuffer || (v && v['∏type'] === 'binary');
    };
});

function typedArrayGuard(property: PropertySchema) {
    return (v: any) => {
        return ArrayBuffer.isView(v) || (v && v['∏type'] === 'binary');
    };
}

for (const name of typedArrayNamesMap.keys()) {
    registerJSONTypeGuard(name, typedArrayGuard);
}

const date = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}.[0-9]{3}Z$/;

registerJSONTypeGuard('date', (property: PropertySchema) => {
    return (v: any) => {
        return v instanceof Date || 'string' === typeof v && date.exec(v) !== null;
    };
});

registerJSONTypeGuard('any', (property: PropertySchema) => {
    return (v: any) => {
        return true;
    };
});

registerJSONTypeGuard('union', (property: PropertySchema) => {
    throw new Error('Union typechecking not implemented. Nested unions thus not supported yet.');
});

registerJSONTypeGuard('array', (property: PropertySchema) => {
    return (v: any) => {
        return v && v.length !== undefined && 'string' !== typeof v || 'function' === typeof v.slice;
    };
});

registerJSONTypeGuard('map', (property: PropertySchema) => {
    return (v: any) => {
        return v && 'object' === typeof v && 'function' !== typeof v.slice;
    };
});

registerJSONTypeGuard('patch', (property: PropertySchema) => {
    return (v: any) => {
        return v && 'object' === typeof v && 'function' !== typeof v.slice;
    };
});

registerJSONTypeGuard('partial', (property: PropertySchema) => {
    return (v: any) => {
        return v && 'object' === typeof v && 'function' !== typeof v.slice;
    };
});

registerJSONTypeGuard('number', (property: PropertySchema) => {
    return (v: any) => {
        return 'number' === typeof v;
    };
});

registerJSONTypeGuard('boolean', (property: PropertySchema) => {
    return (v: any) => {
        return 'boolean' === typeof v;
    };
});

registerJSONTypeGuard('literal', (property: PropertySchema) => {
    if ('number' === typeof property.literalValue) {
        return (v: any) => {
            return 0 + v === property.literalValue;
        };
    }

    if ('string' === typeof property.literalValue) {
        return (v: any) => {
            return '' + v === property.literalValue;
        };
    }

    if (true === property.literalValue) {
        return (v: any) => {
            return v === 'true' || v === '1' || v === 1 || v === true;
        };
    }

    if (false === property.literalValue) {
        return (v: any) => {
            return v === 'false' || v === '0' || v === 0 || v === false;
        };
    }

    return (v: any) => {
        return v === property.literalValue;
    };
});
